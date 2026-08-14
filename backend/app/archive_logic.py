from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app import models


ARCHIVE_AFTER_DAYS = 60


def archive_completed_items(db: Session, user_id: int, now: datetime | None = None) -> int:
    """Move completed workspace items older than 60 days into their archive."""
    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=ARCHIVE_AFTER_DAYS)
    specifications = (
        (models.Task, models.Task.owner_id == user_id, models.Task.completed.is_(True)),
        (models.DailyTodo, models.DailyTodo.user_id == user_id, models.DailyTodo.completed.is_(True)),
        (models.Habit, models.Habit.user_id == user_id, models.Habit.completed.is_(True)),
        (models.Challenge, models.Challenge.user_id == user_id, models.Challenge.completed.is_(True)),
        (models.Project, models.Project.user_id == user_id, models.Project.status == "complete"),
    )
    archived = 0
    for model, owner_filter, completed_filter in specifications:
        archived += db.query(model).filter(
            owner_filter,
            completed_filter,
            model.completed_at.is_not(None),
            model.completed_at <= cutoff,
            model.archived_at.is_(None),
            model.deleted_at.is_(None),
        ).update({model.archived_at: now}, synchronize_session=False)
    if archived:
        db.commit()
    return archived


def set_completion_state(item, completed: bool, now: datetime | None = None) -> None:
    """Keep completion and archive timestamps aligned when an item is completed/reopened."""
    now = now or datetime.utcnow()
    if completed:
        if item.completed_at is None:
            item.completed_at = now
    else:
        item.completed_at = None
        item.archived_at = None
