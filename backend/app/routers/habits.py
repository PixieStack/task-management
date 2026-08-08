from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models
from app.auth import get_current_user, get_db
from app.schemas_extended import HabitCreate, HabitEntryCreate, HabitEntryOut, HabitOut, HabitUpdate

router = APIRouter(prefix="/api/habits", tags=["habits"])

def _get(hid: int, uid: int, db: Session):
    obj = db.query(models.Habit).filter(models.Habit.id == hid, models.Habit.user_id == uid).first()
    if not obj: raise HTTPException(status_code=404, detail="Habit not found")
    return obj

@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(data: HabitCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = models.Habit(user_id=current_user.id, name=data.name.strip(), description=data.description, category=data.category, frequency=data.frequency, target_count=data.target_count, icon=data.icon, color=data.color)
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("", response_model=List[HabitOut])
def get_habits(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Habit).filter(models.Habit.user_id == current_user.id).order_by(models.Habit.created_at.desc()).all()

@router.put("/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: int, data: HabitUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(habit_id, current_user.id, db)
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

@router.post("/entries", response_model=HabitEntryOut, status_code=status.HTTP_201_CREATED)
def create_habit_entry(data: HabitEntryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _get(data.habit_id, current_user.id, db)
    obj = models.HabitEntry(habit_id=data.habit_id, user_id=current_user.id, date=data.date, completed=data.completed, count=data.count, mood=data.mood, energy=data.energy, notes=data.notes)
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/entries", response_model=List[HabitEntryOut])
def get_habit_entries(habit_id: Optional[int] = None, days: int = 30, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    start = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))
    query = db.query(models.HabitEntry).filter(models.HabitEntry.user_id == current_user.id, models.HabitEntry.date >= start)
    if habit_id is not None: _get(habit_id, current_user.id, db); query = query.filter(models.HabitEntry.habit_id == habit_id)
    return query.order_by(models.HabitEntry.date.desc()).all()

@router.post("/{habit_id}/check-in", response_model=HabitEntryOut)
def toggle_habit_check_in(habit_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = _get(habit_id, current_user.id, db); now = datetime.utcnow(); start = datetime(now.year, now.month, now.day); end = start + timedelta(days=1)
    entry = db.query(models.HabitEntry).filter(models.HabitEntry.habit_id == habit_id, models.HabitEntry.user_id == current_user.id, models.HabitEntry.date >= start, models.HabitEntry.date < end).first()
    if entry: entry.completed = not entry.completed; entry.count = habit.target_count if entry.completed else 0; entry.date = now
    else: entry = models.HabitEntry(habit_id=habit_id, user_id=current_user.id, date=now, completed=True, count=habit.target_count); db.add(entry)
    db.commit(); db.refresh(entry); return entry

@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(habit_id, current_user.id, db)
    db.query(models.HabitEntry).filter(models.HabitEntry.habit_id == habit_id, models.HabitEntry.user_id == current_user.id).delete(synchronize_session=False)
    db.delete(obj); db.commit(); return None
