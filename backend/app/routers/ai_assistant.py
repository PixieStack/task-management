import json
import logging
import re
from datetime import date, datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, get_db
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.schemas_extended import AIConversationOut, AIFeedback, AIQuestionCreate

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])
logger = logging.getLogger(__name__)
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

ALLOWED_ACTIONS = {
    "create_task",
    "update_task",
    "complete_task",
    "delete_task",
    "create_todo",
    "update_todo",
    "complete_todo",
    "delete_todo",
    "create_habit",
    "check_in_habit",
    "delete_habit",
    "create_challenge",
    "check_in_challenge",
    "delete_challenge",
    "start_timer",
    "stop_timer",
}

SYSTEM_PROMPT = """You are the action-capable assistant inside a personal productivity app.
You can read the signed-in user's app context and, when explicitly asked, propose app actions.
Return ONLY valid JSON with this exact top-level shape:
{"reply":"short natural-language response","actions":[{"type":"...", ...}]}

Allowed action types:
- create_task: title, optional description, priority (Low/Medium/High), due_date (ISO date/datetime or null), tags (array), time_estimate (minutes)
- update_task: target (task title or numeric id), plus any of title, description, priority, due_date, tags, status, time_estimate
- complete_task: target
- delete_task: target
- create_todo: title, optional notes, todo_date (YYYY-MM-DD, default today), priority
- update_todo: target, plus any of title, notes, todo_date, priority
- complete_todo: target
- delete_todo: target
- create_habit: name, optional description, target_count
- check_in_habit: target
- delete_habit: target
- create_challenge: challenge_type (reading/meditation), optional title, duration, optional daily_goal
- check_in_challenge: target
- delete_challenge: target
- start_timer: item_type (task/todo), target
- stop_timer: no additional fields

Rules:
1. Only emit actions the user actually requested. Never silently delete, complete, or change unrelated items.
2. Use the app context to resolve names and avoid duplicate creation when the user clearly refers to an existing item.
3. If the user asks for advice only, return actions: [].
4. If a request is ambiguous, ask a short clarification in reply and return actions: [].
5. Do not claim an action succeeded. The backend executes and reports results after validation.
6. Keep reply concise.
"""


def _context(db: Session, uid: int) -> dict:
    tasks = db.query(models.Task).filter(models.Task.owner_id == uid).order_by(models.Task.created_at.desc()).limit(40).all()
    todos = db.query(models.DailyTodo).filter(models.DailyTodo.user_id == uid).order_by(models.DailyTodo.todo_date.desc(), models.DailyTodo.created_at.desc()).limit(40).all()
    habits = db.query(models.Habit).filter(models.Habit.user_id == uid).order_by(models.Habit.created_at.desc()).limit(20).all()
    challenges = db.query(models.Challenge).filter(models.Challenge.user_id == uid).order_by(models.Challenge.created_at.desc()).limit(15).all()
    active = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None)).first()
    return {
        "today": date.today().isoformat(),
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "completed": t.completed,
                "time_estimate_minutes": t.time_estimate,
                "time_spent_seconds": t.time_spent_seconds or (t.time_spent or 0) * 60,
            }
            for t in tasks
        ],
        "daily_todos": [
            {
                "id": t.id,
                "title": t.title,
                "todo_date": t.todo_date.isoformat(),
                "priority": t.priority,
                "completed": t.completed,
                "time_spent_seconds": t.time_spent_seconds,
            }
            for t in todos
        ],
        "habits": [{"id": h.id, "name": h.name, "frequency": h.frequency, "target_count": h.target_count} for h in habits],
        "challenges": [
            {
                "id": c.id,
                "title": c.title,
                "type": c.challenge_type,
                "duration": c.duration,
                "current_streak": c.current_streak,
                "progress": c.progress,
                "completed": c.completed,
            }
            for c in challenges
        ],
        "active_timer": (
            {
                "id": active.id,
                "item_type": active.item_type,
                "task_id": active.task_id,
                "todo_id": active.todo_id,
                "started_at": active.started_at.isoformat(),
            }
            if active
            else None
        ),
    }


async def _ask(messages: list[dict]) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured. Set GROQ_API_KEY on the backend.")
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(
                GROQ_CHAT_URL,
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.15,
                    "max_completion_tokens": 1000,
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        if not answer:
            raise ValueError("empty response")
        return answer
    except httpx.HTTPStatusError as exc:
        logger.warning("AI provider returned %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="AI provider returned an error") from exc
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable") from exc


def _json_plan(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL)
    try:
        plan = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan") from exc
    if not isinstance(plan, dict):
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan")
    reply = plan.get("reply")
    actions = plan.get("actions", [])
    if not isinstance(reply, str) or not isinstance(actions, list):
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan")
    for action in actions:
        if not isinstance(action, dict) or action.get("type") not in ALLOWED_ACTIONS:
            raise HTTPException(status_code=502, detail="AI requested an unsupported action")
    return {"reply": reply.strip(), "actions": actions[:10]}


def _find_by_target(query, model, owner_filter, target, name_field):
    if target is None:
        return None
    target_str = str(target).strip()
    if target_str.isdigit():
        return query.filter(model.id == int(target_str), owner_filter).first()
    lowered = target_str.lower()
    exact = query.filter(owner_filter, func.lower(name_field) == lowered).first()
    if exact:
        return exact
    matches = query.filter(owner_filter, func.lower(name_field).contains(lowered)).limit(2).all()
    return matches[0] if len(matches) == 1 else None


def _find_task(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Task), models.Task, models.Task.owner_id == uid, target, models.Task.title)


def _find_todo(db: Session, uid: int, target):
    return _find_by_target(db.query(models.DailyTodo), models.DailyTodo, models.DailyTodo.user_id == uid, target, models.DailyTodo.title)


def _find_habit(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Habit), models.Habit, models.Habit.user_id == uid, target, models.Habit.name)


def _find_challenge(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Challenge), models.Challenge, models.Challenge.user_id == uid, target, models.Challenge.title)


def _parse_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}")


def _stop_active_timer(db: Session, uid: int) -> dict:
    session = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None)).first()
    if not session:
        raise HTTPException(status_code=404, detail="No timer is currently running")
    now = datetime.utcnow()
    elapsed = max(1, int((now - session.started_at).total_seconds()))
    session.ended_at = now
    session.elapsed_seconds = elapsed
    if session.task_id:
        task = _find_task(db, uid, session.task_id)
        if task:
            task.time_spent_seconds = max(0, task.time_spent_seconds or 0) + elapsed
            task.time_spent = int(round(task.time_spent_seconds / 60))
            task.updated_at = now
    if session.todo_id:
        todo = _find_todo(db, uid, session.todo_id)
        if todo:
            todo.time_spent_seconds = max(0, todo.time_spent_seconds or 0) + elapsed
            todo.updated_at = now
    return {"type": "stop_timer", "elapsed_seconds": elapsed, "session_id": session.id}


def _execute_action(action: dict, db: Session, uid: int) -> dict:
    kind = action["type"]

    if kind == "create_task":
        priority = action.get("priority", "Medium")
        if priority not in {"Low", "Medium", "High"}:
            priority = "Medium"
        obj = models.Task(
            owner_id=uid,
            title=str(action.get("title", "")).strip(),
            description=str(action.get("description", "") or "").strip(),
            completed=False,
            status="Not Started",
            priority=priority,
            due_date=_parse_datetime(action.get("due_date")),
            tags=json.dumps(action.get("tags") if isinstance(action.get("tags"), list) else []),
            time_estimate=max(0, int(action.get("time_estimate") or 0)),
            time_spent=0,
            time_spent_seconds=0,
        )
        if not obj.title:
            raise HTTPException(status_code=400, detail="AI task title was empty")
        db.add(obj)
        db.flush()
        return {"type": kind, "id": obj.id, "title": obj.title}

    if kind in {"update_task", "complete_task", "delete_task"}:
        task = _find_task(db, uid, action.get("target"))
        if not task:
            raise HTTPException(status_code=404, detail=f"Task not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_task":
            title = task.title
            db.delete(task)
            return {"type": kind, "id": task.id, "title": title}
        if kind == "complete_task":
            task.completed = True
            task.status = "Completed"
        else:
            for key in ("title", "description", "priority", "status", "time_estimate"):
                if key in action and action[key] is not None:
                    setattr(task, key, action[key])
            if "due_date" in action:
                task.due_date = _parse_datetime(action.get("due_date"))
            if isinstance(action.get("tags"), list):
                task.tags = json.dumps(action["tags"])
            if task.status == "Completed":
                task.completed = True
        task.updated_at = datetime.utcnow()
        return {"type": kind, "id": task.id, "title": task.title}

    if kind == "create_todo":
        priority = action.get("priority", "Medium")
        if priority not in {"Low", "Medium", "High"}:
            priority = "Medium"
        todo_date = date.today()
        if action.get("todo_date"):
            try:
                todo_date = date.fromisoformat(str(action["todo_date"]))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid todo date")
        todo = models.DailyTodo(
            user_id=uid,
            title=str(action.get("title", "")).strip(),
            notes=str(action.get("notes", "") or "").strip(),
            todo_date=todo_date,
            priority=priority,
        )
        if not todo.title:
            raise HTTPException(status_code=400, detail="AI todo title was empty")
        db.add(todo)
        db.flush()
        return {"type": kind, "id": todo.id, "title": todo.title, "todo_date": todo.todo_date.isoformat()}

    if kind in {"update_todo", "complete_todo", "delete_todo"}:
        todo = _find_todo(db, uid, action.get("target"))
        if not todo:
            raise HTTPException(status_code=404, detail=f"Todo not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_todo":
            title = todo.title
            db.delete(todo)
            return {"type": kind, "id": todo.id, "title": title}
        if kind == "complete_todo":
            todo.completed = True
        else:
            for key in ("title", "notes", "priority"):
                if key in action and action[key] is not None:
                    setattr(todo, key, action[key])
            if action.get("todo_date"):
                todo.todo_date = date.fromisoformat(str(action["todo_date"]))
        todo.updated_at = datetime.utcnow()
        return {"type": kind, "id": todo.id, "title": todo.title}

    if kind == "create_habit":
        habit = models.Habit(
            user_id=uid,
            name=str(action.get("name", "")).strip(),
            description=str(action.get("description", "") or "").strip(),
            category="personal",
            frequency="daily",
            target_count=max(1, min(int(action.get("target_count") or 1), 1000)),
            icon="fas fa-check-circle",
        )
        if not habit.name:
            raise HTTPException(status_code=400, detail="AI habit name was empty")
        db.add(habit)
        db.flush()
        return {"type": kind, "id": habit.id, "name": habit.name}

    if kind in {"check_in_habit", "delete_habit"}:
        habit = _find_habit(db, uid, action.get("target"))
        if not habit:
            raise HTTPException(status_code=404, detail=f"Habit not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_habit":
            name = habit.name
            db.query(models.HabitEntry).filter(models.HabitEntry.user_id == uid, models.HabitEntry.habit_id == habit.id).delete(synchronize_session=False)
            db.delete(habit)
            return {"type": kind, "id": habit.id, "name": name}
        now = datetime.utcnow()
        start = datetime(now.year, now.month, now.day)
        entry = db.query(models.HabitEntry).filter(
            models.HabitEntry.user_id == uid,
            models.HabitEntry.habit_id == habit.id,
            models.HabitEntry.date >= start,
        ).first()
        if entry:
            entry.completed = True
            entry.count = habit.target_count
            entry.date = now
        else:
            entry = models.HabitEntry(user_id=uid, habit_id=habit.id, date=now, completed=True, count=habit.target_count)
            db.add(entry)
        return {"type": kind, "id": habit.id, "name": habit.name}

    if kind == "create_challenge":
        challenge_type = str(action.get("challenge_type", "")).lower()
        if challenge_type not in {"reading", "meditation"}:
            raise HTTPException(status_code=400, detail="Challenge type must be reading or meditation")
        title = str(action.get("title") or ("Reading Challenge" if challenge_type == "reading" else "Meditation Challenge")).strip()
        duration = max(1, min(int(action.get("duration") or 21), 365))
        daily_goal = str(action.get("daily_goal") or "show up and make progress").strip()
        challenge = models.Challenge(
            user_id=uid,
            title=title,
            description=f"Daily goal: {daily_goal}",
            duration=duration,
            challenge_type=challenge_type,
            start_date=datetime.utcnow(),
            xp_reward=0,
            icon="fas fa-book-open" if challenge_type == "reading" else "fas fa-spa",
        )
        db.add(challenge)
        db.flush()
        return {"type": kind, "id": challenge.id, "title": challenge.title}

    if kind in {"check_in_challenge", "delete_challenge"}:
        challenge = _find_challenge(db, uid, action.get("target"))
        if not challenge:
            raise HTTPException(status_code=404, detail=f"Challenge not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_challenge":
            title = challenge.title
            db.delete(challenge)
            return {"type": kind, "id": challenge.id, "title": title}
        now = datetime.utcnow()
        if challenge.last_check_in and challenge.last_check_in.date() == now.date():
            return {"type": kind, "id": challenge.id, "title": challenge.title, "already_checked_in": True}
        challenge.current_streak += 1
        challenge.best_streak = max(challenge.best_streak, challenge.current_streak)
        challenge.last_check_in = now
        challenge.progress = min(100.0, (challenge.current_streak / challenge.duration) * 100)
        if challenge.current_streak >= challenge.duration:
            challenge.completed = True
            challenge.is_active = False
        challenge.updated_at = now
        return {"type": kind, "id": challenge.id, "title": challenge.title}

    if kind == "start_timer":
        active = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None)).first()
        if active:
            raise HTTPException(status_code=409, detail="A timer is already running. Stop it first.")
        item_type = action.get("item_type")
        if item_type == "task":
            task = _find_task(db, uid, action.get("target"))
            if not task or task.completed:
                raise HTTPException(status_code=404, detail="Active task not found or target is ambiguous")
            if task.status == "Not Started":
                task.status = "In Progress"
            session = models.TimeSession(user_id=uid, item_type="task", task_id=task.id, started_at=datetime.utcnow())
            label = task.title
        elif item_type == "todo":
            todo = _find_todo(db, uid, action.get("target"))
            if not todo or todo.completed:
                raise HTTPException(status_code=404, detail="Active todo not found or target is ambiguous")
            session = models.TimeSession(user_id=uid, item_type="todo", todo_id=todo.id, started_at=datetime.utcnow())
            label = todo.title
        else:
            raise HTTPException(status_code=400, detail="Timer item type must be task or todo")
        db.add(session)
        db.flush()
        return {"type": kind, "session_id": session.id, "item_type": item_type, "title": label}

    if kind == "stop_timer":
        return _stop_active_timer(db, uid)

    raise HTTPException(status_code=400, detail="Unsupported AI action")


@router.post("/ask", response_model=AIConversationOut)
async def ask_ai(
    data: AIQuestionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = {**_context(db, current_user.id), **(data.context or {})}
    history = db.query(models.AIConversation).filter(models.AIConversation.user_id == current_user.id).order_by(models.AIConversation.created_at.desc()).limit(6).all()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": "App context:\n" + json.dumps(context, default=str)[:16000]},
    ]
    for item in reversed(history):
        messages.append({"role": "user", "content": item.question})
        messages.append({"role": "assistant", "content": item.answer})
    messages.append({"role": "user", "content": data.question})

    plan = _json_plan(await _ask(messages))
    executed = []
    try:
        for action in plan["actions"]:
            executed.append(_execute_action(action, db, current_user.id))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("AI action execution failed")
        raise HTTPException(status_code=500, detail="AI action could not be completed safely") from exc

    final_context = {**context, "requested_actions": plan["actions"], "executed_actions": executed}
    answer = plan["reply"]
    if executed:
        labels = ", ".join(item["type"].replace("_", " ") for item in executed)
        answer = f"{answer} Done: {labels}.".strip()
    obj = models.AIConversation(
        user_id=current_user.id,
        question=data.question,
        answer=answer,
        context=final_context,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/conversations", response_model=List[AIConversationOut])
def conversations(
    limit: int = 20,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.AIConversation).filter(models.AIConversation.user_id == current_user.id).order_by(models.AIConversation.created_at.desc()).limit(max(1, min(limit, 100))).all()


@router.post("/feedback")
def feedback(
    data: AIFeedback,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obj = db.query(models.AIConversation).filter(
        models.AIConversation.id == data.conversation_id,
        models.AIConversation.user_id == current_user.id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Conversation not found")
    obj.feedback = data.feedback
    db.commit()
    return {"message": "Feedback saved"}
