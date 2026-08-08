from datetime import datetime, timedelta
from typing import Any, Dict

import bcrypt
from sqlalchemy.orm import Session

from . import models, schemas


def _password_bytes(password: str) -> bytes:
    """Encode a password for bcrypt while preserving bcrypt's 72-byte limit."""
    return password.encode("utf-8")[:72]


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate):
    obj = models.User(username=user.username.strip(), email=user.email.lower(), hashed_password=get_password_hash(user.password))
    db.add(obj); db.commit(); db.refresh(obj)
    return obj


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email.lower())
    return user if user and verify_password(password, user.hashed_password) else None


def update_user(db: Session, user_id: int, user_update):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: return None
    for key, value in user_update.model_dump(exclude_unset=True).items(): setattr(user, key, value)
    db.commit(); db.refresh(user)
    return user


def update_user_password(db: Session, user_id: int, new_password: str) -> bool:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: return False
    user.hashed_password = get_password_hash(new_password); db.commit(); return True


def get_tasks(db: Session, user_id: int):
    return db.query(models.Task).filter(models.Task.owner_id == user_id).all()


def get_task_analytics(db: Session, user_id: int) -> Dict[str, Any]:
    tasks = get_tasks(db, user_id)
    total = len(tasks); completed = sum(1 for t in tasks if t.completed)
    today = datetime.utcnow().date()
    by_status: Dict[str, int] = {}; by_priority: Dict[str, int] = {}
    for task in tasks:
        by_status[task.status or "Not Started"] = by_status.get(task.status or "Not Started", 0) + 1
        by_priority[task.priority or "Medium"] = by_priority.get(task.priority or "Medium", 0) + 1
    trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        trend.append({"date": day.isoformat(), "completed_tasks": sum(1 for t in tasks if t.completed and t.updated_at and t.updated_at.date() == day)})
    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_rate": round((completed / total * 100) if total else 0.0, 2),
        "total_time_spent": sum(t.time_spent or 0 for t in tasks),
        "overdue_tasks": sum(1 for t in tasks if t.due_date and t.due_date.date() < today and not t.completed),
        "tasks_by_status": by_status,
        "tasks_by_priority": by_priority,
        "productivity_trend": trend,
    }