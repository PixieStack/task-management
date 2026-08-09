from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, get_db
from app.productivity_schemas import DailyTodoCreate, DailyTodoOut, DailyTodoUpdate, TimeSessionOut, TimeSessionStart

router = APIRouter(prefix="/api/productivity", tags=["productivity"])


def _get_todo(todo_id: int, user_id: int, db: Session) -> models.DailyTodo:
    todo = db.query(models.DailyTodo).filter(
        models.DailyTodo.id == todo_id,
        models.DailyTodo.user_id == user_id,
    ).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Daily todo not found")
    return todo


def _get_task(task_id: int, user_id: int, db: Session) -> models.Task:
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.owner_id == user_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _active_session(user_id: int, db: Session) -> Optional[models.TimeSession]:
    return db.query(models.TimeSession).filter(
        models.TimeSession.user_id == user_id,
        models.TimeSession.ended_at.is_(None),
    ).first()


def _session_payload(session: models.TimeSession) -> dict:
    live_elapsed = session.elapsed_seconds
    if session.ended_at is None:
        live_elapsed = max(0, int((datetime.utcnow() - session.started_at).total_seconds()))
    return {
        "id": session.id,
        "user_id": session.user_id,
        "item_type": session.item_type,
        "task_id": session.task_id,
        "todo_id": session.todo_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "elapsed_seconds": session.elapsed_seconds,
        "live_elapsed_seconds": live_elapsed,
        "created_at": session.created_at,
    }


@router.get("/todos", response_model=List[DailyTodoOut])
def list_todos(
    todo_date: Optional[date] = Query(default=None),
    include_completed: bool = Query(default=True),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.DailyTodo).filter(models.DailyTodo.user_id == current_user.id)
    if todo_date is not None:
        query = query.filter(models.DailyTodo.todo_date == todo_date)
    if not include_completed:
        query = query.filter(models.DailyTodo.completed.is_(False))
    return query.order_by(
        models.DailyTodo.completed.asc(),
        models.DailyTodo.todo_date.desc(),
        models.DailyTodo.created_at.desc(),
    ).all()


@router.post("/todos", response_model=DailyTodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(
    data: DailyTodoCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todo = models.DailyTodo(
        user_id=current_user.id,
        title=data.title.strip(),
        notes=(data.notes or "").strip(),
        todo_date=data.todo_date,
        completed=data.completed,
        priority=data.priority,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.put("/todos/{todo_id}", response_model=DailyTodoOut)
def update_todo(
    todo_id: int,
    data: DailyTodoUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todo = _get_todo(todo_id, current_user.id, db)
    for key, value in data.model_dump(exclude_unset=True).items():
        if key in {"title", "notes"} and isinstance(value, str):
            value = value.strip()
        setattr(todo, key, value)
    todo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todo = _get_todo(todo_id, current_user.id, db)
    db.delete(todo)
    db.commit()
    return None


@router.post("/timer/start", response_model=TimeSessionOut, status_code=status.HTTP_201_CREATED)
def start_timer(
    data: TimeSessionStart,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = _active_session(current_user.id, db)
    if active:
        raise HTTPException(status_code=409, detail="Stop the current timer before starting another one")

    task_id = None
    todo_id = None
    if data.item_type == "task":
        task = _get_task(data.item_id, current_user.id, db)
        if task.completed:
            raise HTTPException(status_code=400, detail="Completed tasks cannot be timed")
        task_id = task.id
        if task.status == "Not Started":
            task.status = "In Progress"
            task.updated_at = datetime.utcnow()
    else:
        todo = _get_todo(data.item_id, current_user.id, db)
        if todo.completed:
            raise HTTPException(status_code=400, detail="Completed todos cannot be timed")
        todo_id = todo.id

    session = models.TimeSession(
        user_id=current_user.id,
        item_type=data.item_type,
        task_id=task_id,
        todo_id=todo_id,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_payload(session)


@router.post("/timer/stop", response_model=TimeSessionOut)
def stop_timer(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _active_session(current_user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="No timer is currently running")

    now = datetime.utcnow()
    elapsed = max(1, int((now - session.started_at).total_seconds()))
    session.ended_at = now
    session.elapsed_seconds = elapsed

    if session.item_type == "task" and session.task_id:
        task = _get_task(session.task_id, current_user.id, db)
        task.time_spent_seconds = max(0, task.time_spent_seconds or 0) + elapsed
        task.time_spent = int(round(task.time_spent_seconds / 60))
        task.updated_at = now
    elif session.item_type == "todo" and session.todo_id:
        todo = _get_todo(session.todo_id, current_user.id, db)
        todo.time_spent_seconds = max(0, todo.time_spent_seconds or 0) + elapsed
        todo.updated_at = now

    db.commit()
    db.refresh(session)
    return _session_payload(session)


@router.get("/timer/active", response_model=Optional[TimeSessionOut])
def get_active_timer(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _active_session(current_user.id, db)
    return _session_payload(session) if session else None


@router.get("/timer/sessions", response_model=List[TimeSessionOut])
def list_time_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = db.query(models.TimeSession).filter(
        models.TimeSession.user_id == current_user.id
    ).order_by(models.TimeSession.started_at.desc()).limit(limit).all()
    return [_session_payload(session) for session in sessions]
