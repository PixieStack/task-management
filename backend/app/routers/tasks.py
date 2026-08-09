import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _parse_due_date(value):
    if value is None or isinstance(value, datetime):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid due date") from exc
    return value


def _get(tid: int, uid: int, db: Session):
    obj = db.query(models.Task).filter(models.Task.id == tid, models.Task.owner_id == uid).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    return obj


@router.get("", response_model=List[schemas.TaskOut])
def read_tasks(
    status_filter: Optional[str] = Query(default=None),
    priority_filter: Optional[str] = Query(default=None),
    tag_filter: Optional[str] = Query(default=None),
    include_completed: bool = Query(default=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Task).filter(models.Task.owner_id == current_user.id)
    if status_filter:
        query = query.filter(models.Task.status == status_filter)
    if priority_filter:
        query = query.filter(models.Task.priority == priority_filter)
    if not include_completed:
        query = query.filter(models.Task.completed.is_(False))
    if tag_filter:
        query = query.filter(models.Task.tags.contains(f'"{tag_filter}"'))
    return query.order_by(
        models.Task.completed.asc(),
        models.Task.due_date.asc(),
        models.Task.created_at.desc(),
    ).all()


@router.post("", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    data: schemas.TaskCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    completed = data.completed or data.status == "Completed"
    task_status = "Completed" if completed else data.status
    seconds = data.time_spent_seconds or max(0, data.time_spent) * 60
    minutes = data.time_spent if data.time_spent > 0 else int(round(seconds / 60))
    obj = models.Task(
        title=data.title.strip(),
        description=data.description or "",
        completed=completed,
        status=task_status,
        priority=data.priority,
        due_date=_parse_due_date(data.due_date),
        tags=json.dumps(data.tags or []),
        time_estimate=data.time_estimate,
        time_spent=minutes,
        time_spent_seconds=seconds,
        owner_id=current_user.id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{task_id}", response_model=schemas.TaskOut)
def read_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get(task_id, current_user.id, db)


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    data: schemas.TaskUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obj = _get(task_id, current_user.id, db)
    updates = data.model_dump(exclude_unset=True)
    if "tags" in updates and updates["tags"] is not None:
        updates["tags"] = json.dumps(updates["tags"])
    if "due_date" in updates:
        updates["due_date"] = _parse_due_date(updates["due_date"])
    if "time_spent" in updates and "time_spent_seconds" not in updates:
        updates["time_spent_seconds"] = max(0, updates["time_spent"]) * 60
    elif "time_spent_seconds" in updates and "time_spent" not in updates:
        updates["time_spent"] = int(round(max(0, updates["time_spent_seconds"]) / 60))
    if updates.get("status") == "Completed" or updates.get("completed") is True:
        updates["completed"] = True
        updates["status"] = "Completed"
    elif updates.get("completed") is False and obj.status == "Completed" and "status" not in updates:
        updates["status"] = "Not Started"
    for key, value in updates.items():
        setattr(obj, key, value)
    obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.delete(_get(task_id, current_user.id, db))
    db.commit()
    return None
