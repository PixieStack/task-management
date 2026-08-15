from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models
from app.archive_logic import archive_completed_items
from app.auth import get_current_user, get_db
from app.email_service import send_habit_completion_email
from app.habit_logic import check_in_habit, get_habit_for_check_in, review_habit_completion
from app.schemas_extended import HabitCheckInOut, HabitCompletionReview, HabitCompletionReviewOut, HabitCreate, HabitEntryCreate, HabitEntryOut, HabitOut, HabitUpdate

router = APIRouter(prefix="/api/habits", tags=["habits"])

def _get(hid: int, uid: int, db: Session):
    obj = db.query(models.Habit).filter(
        models.Habit.id == hid,
        models.Habit.user_id == uid,
        models.Habit.deleted_at.is_(None),
    ).first()
    if not obj: raise HTTPException(status_code=404, detail="Habit not found")
    return obj

@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(data: HabitCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = models.Habit(user_id=current_user.id, name=data.name.strip(), description=data.description, category=data.category, frequency="daily", target_count=1, duration_days=data.duration_days, icon=data.icon, color=data.color, completed=False)
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("", response_model=List[HabitOut])
def get_habits(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    archive_completed_items(db, current_user.id)
    return db.query(models.Habit).filter(
        models.Habit.user_id == current_user.id,
        models.Habit.deleted_at.is_(None),
    ).order_by(models.Habit.created_at.desc()).all()

@router.put("/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: int, data: HabitUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(habit_id, current_user.id, db)
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

@router.post("/entries", response_model=HabitEntryOut, status_code=status.HTTP_201_CREATED)
def create_habit_entry(data: HabitEntryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    raise HTTPException(status_code=405, detail="Habit progress can only be recorded with the protected daily check-in")

@router.get("/entries", response_model=List[HabitEntryOut])
def get_habit_entries(habit_id: Optional[int] = None, days: int = 30, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    start = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))
    query = db.query(models.HabitEntry).filter(
        models.HabitEntry.user_id == current_user.id,
        models.HabitEntry.date >= start,
        models.HabitEntry.deleted_at.is_(None),
    )
    if habit_id is not None: _get(habit_id, current_user.id, db); query = query.filter(models.HabitEntry.habit_id == habit_id)
    return query.order_by(models.HabitEntry.date.desc()).all()

@router.post("/{habit_id}/check-in", response_model=HabitCheckInOut)
def daily_habit_check_in(
    habit_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    habit = get_habit_for_check_in(db, habit_id, current_user.id)
    entry, review_required = check_in_habit(db, habit, current_user.id)
    db.commit()
    db.refresh(entry)
    db.refresh(habit)
    return {
        "habit": habit,
        "entry": entry,
        "review_required": review_required,
        "completion_email_queued": False,
    }


@router.post("/{habit_id}/completion-review", response_model=HabitCompletionReviewOut)
def complete_habit_review(
    habit_id: int,
    data: HabitCompletionReview,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    habit = get_habit_for_check_in(db, habit_id, current_user.id)
    completed_now = review_habit_completion(db, habit, data.established, data.additional_days)
    db.commit()
    db.refresh(habit)
    if completed_now:
        background_tasks.add_task(
            send_habit_completion_email,
            current_user.email,
            current_user.username,
            habit.name,
            habit.duration_days,
        )
    return {
        "habit": habit,
        "completed_now": completed_now,
        "completion_email_queued": completed_now,
    }

@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(habit_id, current_user.id, db)
    now = datetime.utcnow()
    obj.deleted_at = now
    db.query(models.HabitEntry).filter(
        models.HabitEntry.habit_id == habit_id,
        models.HabitEntry.user_id == current_user.id,
        models.HabitEntry.deleted_at.is_(None),
    ).update({models.HabitEntry.deleted_at: now}, synchronize_session=False)
    db.commit(); return None
