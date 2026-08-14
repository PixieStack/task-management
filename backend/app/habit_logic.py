from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


HABIT_CHECK_IN_COOLDOWN = timedelta(hours=24)


def get_habit_for_check_in(db: Session, habit_id: int, user_id: int) -> models.Habit:
    habit = (
        db.query(models.Habit)
        .filter(
            models.Habit.id == habit_id,
            models.Habit.user_id == user_id,
            models.Habit.deleted_at.is_(None),
        )
        .with_for_update()
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


def check_in_habit(db: Session, habit: models.Habit, user_id: int):
    now = datetime.utcnow()
    if habit.completed:
        raise HTTPException(status_code=409, detail="This habit is already complete")
    if habit.completion_review_required:
        raise HTTPException(status_code=409, detail="Please answer the habit completion question before checking in again")

    next_check_in_at = habit.last_check_in_at + HABIT_CHECK_IN_COOLDOWN if habit.last_check_in_at else None
    if next_check_in_at and now < next_check_in_at:
        retry_after_seconds = max(1, int((next_check_in_at - now).total_seconds()))
        raise HTTPException(
            status_code=429,
            detail={
                "message": "You already checked in. Your next check-in unlocks after 24 hours.",
                "next_check_in_at": next_check_in_at.isoformat(),
                "retry_after_seconds": retry_after_seconds,
            },
            headers={"Retry-After": str(retry_after_seconds)},
        )

    completed_count = (
        db.query(models.HabitEntry)
        .filter(
            models.HabitEntry.habit_id == habit.id,
            models.HabitEntry.user_id == user_id,
            models.HabitEntry.completed.is_(True),
            models.HabitEntry.deleted_at.is_(None),
        )
        .count()
    )
    entry = models.HabitEntry(
        habit_id=habit.id,
        user_id=user_id,
        date=now,
        completed=True,
        count=1,
    )
    db.add(entry)
    habit.target_count = 1
    habit.last_check_in_at = now
    db.flush()
    review_required = completed_count + 1 >= habit.duration_days
    return entry, review_required


def review_habit_completion(
    db: Session,
    habit: models.Habit,
    established: bool,
    additional_days: int | None = None,
):
    if habit.completed:
        raise HTTPException(status_code=409, detail="This habit is already complete")
    if not habit.completion_review_required:
        raise HTTPException(status_code=409, detail="Complete the planned daily check-ins before reviewing this habit")

    if established:
        habit.completed = True
        habit.completed_at = datetime.utcnow()
        db.flush()
        return True

    if not additional_days:
        raise HTTPException(status_code=422, detail="Choose how many additional days you need")
    if habit.duration_days + additional_days > 3650:
        raise HTTPException(status_code=422, detail="The total habit duration cannot exceed 3650 days")
    habit.duration_days += additional_days
    habit.completed = False
    habit.completed_at = None
    db.flush()
    return False
