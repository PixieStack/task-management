from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json
from . import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Password Utilities ---
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- User-related CRUD operations ---
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_pw = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

# --- Task-related CRUD operations ---
def create_task(db: Session, task: schemas.TaskCreate, user_id: int):
    # Convert tags list to JSON string
    tags_json = json.dumps(task.tags) if task.tags else "[]"
    
    db_task = models.Task(
        title=task.title,
        description=task.description,
        completed=task.completed,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        tags=tags_json,
        time_estimate=task.time_estimate,
        time_spent=task.time_spent,
        owner_id=user_id
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_tasks(db: Session, user_id: int):
    return db.query(models.Task).filter(models.Task.owner_id == user_id).all()

def get_task_by_id(db: Session, task_id: int, user_id: int):
    return db.query(models.Task).filter(
        models.Task.id == task_id, 
        models.Task.owner_id == user_id
    ).first()

def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate, user_id: int):
    task = get_task_by_id(db, task_id, user_id)
    if not task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    
    # Handle tags conversion
    if 'tags' in update_data:
        update_data['tags'] = json.dumps(update_data['tags'])
    
    for key, value in update_data.items():
        setattr(task, key, value)
    
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, task_id: int, user_id: int):
    task = get_task_by_id(db, task_id, user_id)
    if not task:
        return None
    
    db.delete(task)
    db.commit()
    return True

# --- Analytics CRUD operations ---
def get_task_analytics(db: Session, user_id: int) -> Dict[str, Any]:
    # Get all tasks for the user
    tasks = get_tasks(db, user_id)
    
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.completed])
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    total_time_spent = sum(t.time_spent or 0 for t in tasks)
    
    # Count overdue tasks
    today = datetime.now().date()
    overdue_tasks = len([
        t for t in tasks 
        if t.due_date and t.due_date.date() < today and not t.completed
    ])
    
    # Tasks by status
    tasks_by_status = {}
    for task in tasks:
        status = task.status or "Not Started"
        tasks_by_status[status] = tasks_by_status.get(status, 0) + 1
    
    # Tasks by priority
    tasks_by_priority = {}
    for task in tasks:
        priority = task.priority or "Medium"
        tasks_by_priority[priority] = tasks_by_priority.get(priority, 0) + 1
    
    # Productivity trend (last 7 days)
    productivity_trend = []
    for i in range(7):
        date = today - timedelta(days=i)
        completed_on_date = len([
            t for t in tasks 
            if t.updated_at and t.updated_at.date() == date and t.completed
        ])
        productivity_trend.append({
            "date": date.isoformat(),
            "completed_tasks": completed_on_date
        })
    
    productivity_trend.reverse()  # Most recent first
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": round(completion_rate, 2),
        "total_time_spent": total_time_spent,
        "overdue_tasks": overdue_tasks,
        "tasks_by_status": tasks_by_status,
        "tasks_by_priority": tasks_by_priority,
        "productivity_trend": productivity_trend
    }

# --- Contact Message CRUD ---
def save_contact_message(db: Session, msg: schemas.ContactMessageCreate):
    message = models.ContactMessage(**msg.dict())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def update_user(db: Session, user_id: int, user_update):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user_id: int, new_password: str):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return False
    
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    return True