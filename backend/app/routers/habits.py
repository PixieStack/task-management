from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from app import models
from app.schemas_extended import HabitCreate, HabitUpdate, HabitOut, HabitEntryCreate, HabitEntryOut
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/habits", tags=["habits"])


@router.post("/", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(habit: HabitCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new habit"""
    db_habit = models.Habit(
        user_id=current_user.id,
        name=habit.name,
        description=habit.description,
        category=habit.category,
        frequency=habit.frequency,
        target_count=habit.target_count,
        icon=habit.icon,
        color=habit.color
    )
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit


@router.get("/", response_model=List[HabitOut])
def get_habits(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all habits for current user"""
    habits = db.query(models.Habit).filter(models.Habit.user_id == current_user.id).all()
    return habits


@router.post("/entries", response_model=HabitEntryOut, status_code=status.HTTP_201_CREATED)
def create_habit_entry(entry: HabitEntryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log a habit entry"""
    # Verify habit belongs to user
    habit = db.query(models.Habit).filter(
        models.Habit.id == entry.habit_id,
        models.Habit.user_id == current_user.id
    ).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    db_entry = models.HabitEntry(
        habit_id=entry.habit_id,
        user_id=current_user.id,
        date=entry.date,
        completed=entry.completed,
        count=entry.count,
        mood=entry.mood,
        energy=entry.energy,
        notes=entry.notes
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.get("/entries", response_model=List[HabitEntryOut])
def get_habit_entries(habit_id: int = None, days: int = 30, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get habit entries for a specific habit or all habits"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(models.HabitEntry).filter(
        models.HabitEntry.user_id == current_user.id,
        models.HabitEntry.date >= start_date
    )
    
    if habit_id:
        query = query.filter(models.HabitEntry.habit_id == habit_id)
    
    entries = query.all()
    return entries


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete habit"""
    habit = db.query(models.Habit).filter(
        models.Habit.id == habit_id,
        models.Habit.user_id == current_user.id
    ).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    db.delete(habit)
    db.commit()
    return
