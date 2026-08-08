import json
import logging
from typing import List
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models
from app.auth import get_current_user, get_db
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.schemas_extended import AIConversationOut, AIFeedback, AIQuestionCreate

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])
logger = logging.getLogger(__name__)
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
SYSTEM_PROMPT = "You are a concise productivity assistant for a task manager. Use the supplied tasks, habits, reading challenges, and meditation challenge progress to suggest practical next actions. Never claim work was completed unless the context says it was."

def _context(db: Session, uid: int) -> dict:
    tasks = db.query(models.Task).filter(models.Task.owner_id == uid).order_by(models.Task.created_at.desc()).limit(25).all()
    habits = db.query(models.Habit).filter(models.Habit.user_id == uid).order_by(models.Habit.created_at.desc()).limit(15).all()
    challenges = db.query(models.Challenge).filter(models.Challenge.user_id == uid).order_by(models.Challenge.created_at.desc()).limit(10).all()
    return {
        "tasks": [{"title": t.title, "status": t.status, "priority": t.priority, "due_date": t.due_date.isoformat() if t.due_date else None, "completed": t.completed} for t in tasks],
        "habits": [{"name": h.name, "frequency": h.frequency, "target_count": h.target_count} for h in habits],
        "challenges": [{"title": c.title, "type": c.challenge_type, "duration": c.duration, "current_streak": c.current_streak, "progress": c.progress, "completed": c.completed} for c in challenges],
    }

async def _ask(messages: list[dict]) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured. Set GROQ_API_KEY on the backend.")
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(GROQ_CHAT_URL, json={"model": GROQ_MODEL, "messages": messages, "temperature": 0.5, "max_completion_tokens": 700}, headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"})
            response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        if not answer: raise ValueError("empty response")
        return answer
    except httpx.HTTPStatusError as exc:
        logger.warning("AI provider returned %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="AI provider returned an error") from exc
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable") from exc

@router.post("/ask", response_model=AIConversationOut)
async def ask_ai(data: AIQuestionCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    context = {**_context(db, current_user.id), **(data.context or {})}
    history = db.query(models.AIConversation).filter(models.AIConversation.user_id == current_user.id).order_by(models.AIConversation.created_at.desc()).limit(6).all()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "system", "content": "App context:\n" + json.dumps(context, default=str)[:12000]}]
    for item in reversed(history):
        messages.append({"role": "user", "content": item.question}); messages.append({"role": "assistant", "content": item.answer})
    messages.append({"role": "user", "content": data.question})
    obj = models.AIConversation(user_id=current_user.id, question=data.question, answer=await _ask(messages), context=context)
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/conversations", response_model=List[AIConversationOut])
def conversations(limit: int = 20, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.AIConversation).filter(models.AIConversation.user_id == current_user.id).order_by(models.AIConversation.created_at.desc()).limit(max(1, min(limit, 100))).all()

@router.post("/feedback")
def feedback(data: AIFeedback, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = db.query(models.AIConversation).filter(models.AIConversation.id == data.conversation_id, models.AIConversation.user_id == current_user.id).first()
    if not obj: raise HTTPException(status_code=404, detail="Conversation not found")
    obj.feedback = data.feedback; db.commit(); return {"message": "Feedback saved"}
