from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import random
import json
from app import models
from app.schemas_extended import AIQuestionCreate, AIConversationOut, AIFeedback
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])


# Simple pattern-based AI responses (learns from user interactions)
AI_KNOWLEDGE_BASE = {
    "challenge": [
        "Starting a challenge is a great way to build discipline. I recommend beginning with a 21-day challenge.",
        "The key to completing challenges is consistency. Check in every day at the same time.",
        "If you miss a day, don't give up! Just start your streak again tomorrow."
    ],
    "task": [
        "Break large tasks into smaller, manageable pieces.",
        "Use the Pomodoro Technique: 25 minutes of focused work, then a 5-minute break.",
        "Prioritize your tasks using the Eisenhower Matrix: urgent vs important."
    ],
    "diet": [
        "Meal planning ahead of time helps you make healthier choices.",
        "Remember to drink water throughout the day, not just when you're thirsty.",
        "Balance is key - don't completely restrict foods you enjoy."
    ],
    "habit": [
        "Habits typically take 21-66 days to form. Be patient with yourself.",
        "Stack new habits onto existing ones for better success.",
        "Track your habits daily to see your progress over time."
    ],
    "motivation": [
        "Remember why you started. Your goals are worth the effort!",
        "Progress, not perfection. Every small step counts.",
        "You're stronger than you think. Keep pushing forward!"
    ],
    "default": [
        "I'm here to help! Can you tell me more about what you're working on?",
        "That's a great question. Based on your activity, I suggest focusing on consistency.",
        "Let me help you break that down into actionable steps."
    ]
}


def generate_ai_response(question: str, user_context: dict, db: Session, user_id: int) -> str:
    """Generate AI response based on question and learned patterns"""
    question_lower = question.lower()
    
    # Learn from past conversations
    past_conversations = db.query(models.AIConversation).filter(
        models.AIConversation.user_id == user_id
    ).order_by(models.AIConversation.created_at.desc()).limit(20).all()
    
    # Determine category
    category = "default"
    for key in AI_KNOWLEDGE_BASE.keys():
        if key in question_lower:
            category = key
            break
    
    # Get base response
    base_responses = AI_KNOWLEDGE_BASE[category]
    response = random.choice(base_responses)
    
    # Personalize based on user data
    if user_context:
        if "challenges_completed" in user_context:
            response += f" You've already completed {user_context['challenges_completed']} challenges!"
        if "current_streak" in user_context:
            response += f" Your current streak is {user_context['current_streak']} days - keep it going!"
        if "level" in user_context:
            response += f" As a Level {user_context['level']} user, you're doing great!"
    
    # Learn from highly-rated past responses
    good_responses = [c for c in past_conversations if c.feedback and c.feedback >= 4]
    if good_responses and random.random() > 0.7:  # 30% chance to reference past good advice
        past_response = random.choice(good_responses)
        response += f" Remember: {past_response.answer[:100]}..."
    
    return response


@router.post("/ask", response_model=AIConversationOut)
def ask_ai(question_data: AIQuestionCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ask AI assistant a question"""
    # Get user context for personalization
    stats = db.query(models.UserStatistics).filter(
        models.UserStatistics.user_id == current_user.id
    ).first()
    
    user_context = question_data.context or {}
    if stats:
        user_context.update({
            "level": stats.level,
            "total_xp": stats.total_xp,
            "challenges_completed": stats.challenges_completed,
            "current_streak": stats.current_streak
        })
    
    # Generate AI response
    answer = generate_ai_response(question_data.question, user_context, db, current_user.id)
    
    # Save conversation
    conversation = models.AIConversation(
        user_id=current_user.id,
        question=question_data.question,
        answer=answer,
        context=user_context
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    # Store as ML training data
    ml_data = models.MLTrainingData(
        user_id=current_user.id,
        data_type="ai_conversation",
        features={
            "question_length": len(question_data.question),
            "context": user_context,
            "question_keywords": [word for word in question_data.question.lower().split() if len(word) > 3]
        },
        labels={"answer": answer}
    )
    db.add(ml_data)
    db.commit()
    
    return conversation


@router.get("/conversations", response_model=List[AIConversationOut])
def get_conversations(limit: int = 20, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get conversation history"""
    conversations = db.query(models.AIConversation).filter(
        models.AIConversation.user_id == current_user.id
    ).order_by(models.AIConversation.created_at.desc()).limit(limit).all()
    return conversations


@router.post("/feedback")
def provide_feedback(feedback_data: AIFeedback, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Provide feedback on AI response (helps it learn)"""
    conversation = db.query(models.AIConversation).filter(
        models.AIConversation.id == feedback_data.conversation_id,
        models.AIConversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.feedback = feedback_data.feedback
    db.commit()
    
    # Update ML training data with feedback
    ml_data = db.query(models.MLTrainingData).filter(
        models.MLTrainingData.user_id == current_user.id,
        models.MLTrainingData.data_type == "ai_conversation"
    ).order_by(models.MLTrainingData.created_at.desc()).first()
    
    if ml_data:
        labels = ml_data.labels or {}
        labels["feedback"] = feedback_data.feedback
        ml_data.labels = labels
        db.commit()
    
    return {"message": "Feedback received. AI will learn from this!"}
