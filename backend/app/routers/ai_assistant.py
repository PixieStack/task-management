import json
import logging
import re
import uuid
from datetime import date, datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.ai_workflows import accept_values, build_action, detect_workflow, form_prompt, start_workflow
from app.archive_logic import archive_completed_items, set_completion_state
from app.auth import get_current_user, get_db
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.email_service import send_challenge_completion_email, send_project_completion_email
from app.habit_logic import check_in_habit, get_habit_for_check_in
from app.schemas_extended import AIChatOut, AIConversationOut, AIFeedback, AIQuestionCreate

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])
logger = logging.getLogger(__name__)
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

ALLOWED_ACTIONS = {
    "create_task",
    "update_task",
    "complete_task",
    "delete_task",
    "create_todo",
    "update_todo",
    "complete_todo",
    "delete_todo",
    "create_habit",
    "check_in_habit",
    "delete_habit",
    "create_challenge",
    "check_in_challenge",
    "delete_challenge",
    "create_project",
    "update_project",
    "delete_project",
    "start_timer",
    "stop_timer",
    "open_focus_timer",
}

GUIDED_ACTION_TYPES = {
    "create_task": "task",
    "create_todo": "todo",
    "create_habit": "habit",
    "create_challenge": "challenge",
    "create_project": "project",
    "start_timer": "tracked_timer",
    "open_focus_timer": "pomodoro",
}

SYSTEM_PROMPT = """You are the action-capable assistant inside a personal productivity app.
You help naturally and conversationally. You can read the signed-in user's app context and, when explicitly asked, propose app actions.
Return ONLY valid JSON with this exact top-level shape:
{"reply":"short natural-language response","actions":[{"type":"...", ...}]}

Allowed action types:
- create_task: title, optional description, required priority (Low/Medium/High), required due_date (ISO datetime including date and time), tags (array), time_estimate (minutes)
- update_task: target (task title or numeric id), plus any of title, description, priority, due_date, tags, status, time_estimate
- complete_task: target
- delete_task: target
- create_todo: title, optional notes, todo_date (YYYY-MM-DD, default today), priority
- update_todo: target, plus any of title, notes, todo_date, priority
- complete_todo: target
- delete_todo: target
- create_habit: name, optional description, duration_days (21, 30, 60, 90, or custom 1-365)
- check_in_habit: target
- delete_habit: target
- create_challenge: challenge_type (reading), required title (the book title), book_type (fiction/non_fiction), duration, and daily_goal. Use this when the user asks for a reading plan or challenge.
- check_in_challenge: target
- delete_challenge: target
- create_project: required title, description, and category. New projects always begin in progress.
- update_project: target, plus any of title, description, category, status
- delete_project: target
- start_timer: item_type (task/todo), target
- stop_timer: no additional fields

Rules:
1. Only emit actions the user actually requested. Never silently delete, complete, or change unrelated items.
2. Use the app context to resolve names and avoid duplicate creation when the user clearly refers to an existing item.
3. If the user asks for advice only, return actions: [].
4. If a request is ambiguous, ask a short clarification in reply and return actions: [].
5. Do not claim an action succeeded. The backend executes and reports results after validation. For an action request, reply with a short friendly acknowledgement of what you understood.
6. For ordinary questions, answer warmly in plain language rather than sounding robotic or listing internal action names.
7. Keep reply concise and never mention JSON, schemas, databases, action types, or implementation details.
8. Act only on the latest user message. Earlier actions in this chat are completed history and must never be repeated unless the latest message explicitly asks for them again.
"""


def _context(db: Session, uid: int) -> dict:
    archive_completed_items(db, uid)
    tasks = db.query(models.Task).filter(models.Task.owner_id == uid, models.Task.deleted_at.is_(None), models.Task.archived_at.is_(None)).order_by(models.Task.created_at.desc()).limit(40).all()
    todos = db.query(models.DailyTodo).filter(models.DailyTodo.user_id == uid, models.DailyTodo.deleted_at.is_(None), models.DailyTodo.archived_at.is_(None)).order_by(models.DailyTodo.todo_date.desc(), models.DailyTodo.created_at.desc()).limit(40).all()
    habits = db.query(models.Habit).filter(models.Habit.user_id == uid, models.Habit.deleted_at.is_(None), models.Habit.archived_at.is_(None)).order_by(models.Habit.created_at.desc()).limit(20).all()
    challenges = db.query(models.Challenge).filter(models.Challenge.user_id == uid, models.Challenge.deleted_at.is_(None), models.Challenge.archived_at.is_(None)).order_by(models.Challenge.created_at.desc()).limit(15).all()
    projects = db.query(models.Project).filter(models.Project.user_id == uid, models.Project.deleted_at.is_(None), models.Project.archived_at.is_(None)).order_by(models.Project.updated_at.desc()).limit(20).all()
    project_categories = db.query(models.ProjectCategory).filter(models.ProjectCategory.user_id == uid).order_by(models.ProjectCategory.name.asc()).all()
    active = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None), models.TimeSession.deleted_at.is_(None)).first()
    return {
        "today": date.today().isoformat(),
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "completed": t.completed,
                "time_estimate_minutes": t.time_estimate,
                "time_spent_seconds": t.time_spent_seconds or (t.time_spent or 0) * 60,
            }
            for t in tasks
        ],
        "daily_todos": [
            {
                "id": t.id,
                "title": t.title,
                "todo_date": t.todo_date.isoformat(),
                "priority": t.priority,
                "completed": t.completed,
                "time_spent_seconds": t.time_spent_seconds,
            }
            for t in todos
        ],
        "habits": [{"id": h.id, "name": h.name, "duration_days": h.duration_days, "check_in_count": h.check_in_count, "completed": h.completed, "completion_review_required": h.completion_review_required, "can_check_in": h.can_check_in} for h in habits],
        "challenges": [
            {
                "id": c.id,
                "title": c.title,
                "type": c.challenge_type,
                "duration": c.duration,
                "current_streak": c.current_streak,
                "progress": c.progress,
                "completed": c.completed,
            }
            for c in challenges
        ],
        "projects": [
            {
                "id": project.id,
                "title": project.title,
                "category": project.category,
                "status": project.status,
            }
            for project in projects
        ],
        "project_categories": [{"id": category.id, "name": category.name} for category in project_categories],
        "active_timer": (
            {
                "id": active.id,
                "item_type": active.item_type,
                "task_id": active.task_id,
                "todo_id": active.todo_id,
                "started_at": active.started_at.isoformat(),
            }
            if active
            else None
        ),
    }


async def _ask(messages: list[dict]) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured. Set GROQ_API_KEY on the backend.")
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(
                GROQ_CHAT_URL,
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.15,
                    "max_completion_tokens": 1000,
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
        if not answer:
            raise ValueError("empty response")
        return answer
    except httpx.HTTPStatusError as exc:
        logger.warning("AI provider returned %s", exc.response.status_code)
        raise HTTPException(status_code=502, detail="AI provider returned an error") from exc
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="AI service is temporarily unavailable") from exc


def _json_plan(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL)
    try:
        plan = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan") from exc
    if not isinstance(plan, dict):
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan")
    reply = plan.get("reply")
    actions = plan.get("actions", [])
    if not isinstance(reply, str) or not isinstance(actions, list):
        raise HTTPException(status_code=502, detail="AI returned an invalid action plan")
    for action in actions:
        if not isinstance(action, dict) or action.get("type") not in ALLOWED_ACTIONS:
            raise HTTPException(status_code=502, detail="AI requested an unsupported action")
    return {"reply": reply.strip() or "How can I help with that?", "actions": actions[:10]}


def _safe_ui_context(value: dict) -> dict:
    section = value.get("active_section") if isinstance(value, dict) else None
    return {"active_section": section} if section in {"overview", "tasks", "habits", "challenges", "ai"} else {}


def _natural_action_reply(executed: list[dict]) -> str:
    phrases = []
    for item in executed:
        kind = item["type"]
        label = item.get("title") or item.get("name")
        quoted = f' “{label}”' if label else ""
        phrase = {
            "create_task": f"created the task{quoted}",
            "update_task": f"updated the task{quoted}",
            "complete_task": f"completed the task{quoted}",
            "delete_task": f"deleted the task{quoted}",
            "create_todo": f"added the Todo{quoted}",
            "update_todo": f"updated the Todo{quoted}",
            "complete_todo": f"completed the Todo{quoted}",
            "delete_todo": f"deleted the Todo{quoted}",
            "create_habit": f"created the habit{quoted}",
            "check_in_habit": f"checked in the habit{quoted}",
            "delete_habit": f"deleted the habit{quoted}",
            "create_challenge": f"started the reading plan{quoted}",
            "check_in_challenge": f"checked in the plan{quoted}",
            "delete_challenge": f"deleted the plan{quoted}",
            "create_project": f"created the project{quoted}",
            "update_project": f"updated the project{quoted}",
            "delete_project": f"deleted the project{quoted}",
            "start_timer": f"started timing{quoted}",
            "stop_timer": "stopped the timer and saved the elapsed time",
            "open_focus_timer": "prepared the Pomodoro timer",
        }.get(kind, "updated your workspace")
        phrases.append(phrase)
    if len(phrases) == 1:
        summary = phrases[0]
    else:
        summary = ", ".join(phrases[:-1]) + f" and {phrases[-1]}"
    return f"Done — I {summary}."


def _workflow_reply(prompt: dict, *, started: bool = False) -> str:
    if prompt.get("errors"):
        return "A couple of details still need your attention. Fix them below, then send everything together."
    return "I just need a few quick details. Answer them together and I’ll take care of the rest."


def _save_ai_turn(db: Session, *, uid: int, chat_id: str, question: str, answer: str, context: dict) -> models.AIConversation:
    obj = models.AIConversation(user_id=uid, chat_id=chat_id, question=question, answer=answer, context=context)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _find_by_target(query, model, owner_filter, target, name_field):
    if target is None:
        return None
    target_str = str(target).strip()
    if target_str.isdigit():
        return query.filter(model.id == int(target_str), owner_filter).first()
    lowered = target_str.lower()
    exact = query.filter(owner_filter, func.lower(name_field) == lowered).first()
    if exact:
        return exact
    matches = query.filter(owner_filter, func.lower(name_field).contains(lowered)).limit(2).all()
    return matches[0] if len(matches) == 1 else None


def _find_task(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Task).filter(models.Task.deleted_at.is_(None), models.Task.archived_at.is_(None)), models.Task, models.Task.owner_id == uid, target, models.Task.title)


def _find_todo(db: Session, uid: int, target):
    return _find_by_target(db.query(models.DailyTodo).filter(models.DailyTodo.deleted_at.is_(None), models.DailyTodo.archived_at.is_(None)), models.DailyTodo, models.DailyTodo.user_id == uid, target, models.DailyTodo.title)


def _find_habit(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Habit).filter(models.Habit.deleted_at.is_(None), models.Habit.archived_at.is_(None)), models.Habit, models.Habit.user_id == uid, target, models.Habit.name)


def _find_challenge(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Challenge).filter(models.Challenge.deleted_at.is_(None), models.Challenge.archived_at.is_(None)), models.Challenge, models.Challenge.user_id == uid, target, models.Challenge.title)


def _find_project(db: Session, uid: int, target):
    return _find_by_target(db.query(models.Project).filter(models.Project.deleted_at.is_(None), models.Project.archived_at.is_(None)), models.Project, models.Project.user_id == uid, target, models.Project.title)


def _parse_datetime(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}")


def _stop_active_timer(db: Session, uid: int) -> dict:
    session = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None), models.TimeSession.deleted_at.is_(None)).first()
    if not session:
        raise HTTPException(status_code=404, detail="No timer is currently running")
    now = datetime.utcnow()
    elapsed = max(1, int((now - session.started_at).total_seconds()))
    session.ended_at = now
    session.elapsed_seconds = elapsed
    if session.task_id:
        task = _find_task(db, uid, session.task_id)
        if task:
            task.time_spent_seconds = max(0, task.time_spent_seconds or 0) + elapsed
            task.time_spent = int(round(task.time_spent_seconds / 60))
            task.updated_at = now
    if session.todo_id:
        todo = _find_todo(db, uid, session.todo_id)
        if todo:
            todo.time_spent_seconds = max(0, todo.time_spent_seconds or 0) + elapsed
            todo.updated_at = now
    return {"type": "stop_timer", "elapsed_seconds": elapsed, "session_id": session.id}


def _stop_timer_for_item(db: Session, uid: int, *, task_id: int | None = None, todo_id: int | None = None) -> None:
    query = db.query(models.TimeSession).filter(
        models.TimeSession.user_id == uid,
        models.TimeSession.ended_at.is_(None),
        models.TimeSession.deleted_at.is_(None),
    )
    query = query.filter(models.TimeSession.task_id == task_id) if task_id is not None else query.filter(models.TimeSession.todo_id == todo_id)
    if query.first():
        _stop_active_timer(db, uid)


def _execute_action(
    action: dict,
    db: Session,
    uid: int,
    current_user: models.User | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    kind = action["type"]

    if kind == "create_task":
        priority = action.get("priority")
        if priority not in {"Low", "Medium", "High"}:
            raise HTTPException(status_code=400, detail="Task priority is required")
        due_date = action.get("due_date")
        if not due_date or not re.search(r"[T ]\d{2}:\d{2}", str(due_date)):
            raise HTTPException(status_code=400, detail="Task due date and time are required")
        obj = models.Task(
            owner_id=uid,
            title=str(action.get("title", "")).strip(),
            description=str(action.get("description", "") or "").strip(),
            completed=False,
            status="Not Started",
            priority=priority,
            due_date=_parse_datetime(due_date),
            tags=json.dumps(action.get("tags") if isinstance(action.get("tags"), list) else []),
            time_estimate=max(0, int(action.get("time_estimate") or 0)),
            time_spent=0,
            time_spent_seconds=0,
        )
        if not obj.title:
            raise HTTPException(status_code=400, detail="AI task title was empty")
        requested_status = str(action.get("status") or "Not Started")
        if requested_status not in {"Not Started", "In Progress", "Pending", "Completed"}:
            raise HTTPException(status_code=400, detail="Invalid task status")
        obj.status = requested_status
        obj.completed = requested_status == "Completed"
        set_completion_state(obj, obj.completed)
        db.add(obj)
        db.flush()
        return {"type": kind, "id": obj.id, "title": obj.title}

    if kind in {"update_task", "complete_task", "delete_task"}:
        task = _find_task(db, uid, action.get("target"))
        if not task:
            raise HTTPException(status_code=404, detail=f"Task not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_task":
            title = task.title
            _stop_timer_for_item(db, uid, task_id=task.id)
            now = datetime.utcnow()
            task.deleted_at = now
            task.updated_at = now
            db.query(models.TimeSession).filter(
                models.TimeSession.user_id == uid,
                models.TimeSession.task_id == task.id,
                models.TimeSession.deleted_at.is_(None),
            ).update({models.TimeSession.deleted_at: now}, synchronize_session=False)
            return {"type": kind, "id": task.id, "title": title}
        if kind == "complete_task":
            _stop_timer_for_item(db, uid, task_id=task.id)
            task.completed = True
            task.status = "Completed"
        else:
            for key in ("title", "description", "time_estimate"):
                if key in action and action[key] is not None:
                    setattr(task, key, action[key])
            if "priority" in action:
                priority = str(action["priority"])
                if priority not in {"Low", "Medium", "High"}:
                    raise HTTPException(status_code=400, detail="Task priority must be Low, Medium, or High")
                task.priority = priority
            if "status" in action:
                status = str(action["status"])
                if status not in {"Not Started", "In Progress", "Pending", "Completed"}:
                    raise HTTPException(status_code=400, detail="Invalid task status")
                task.status = status
                task.completed = status == "Completed"
            if "due_date" in action:
                task.due_date = _parse_datetime(action.get("due_date"))
            if isinstance(action.get("tags"), list):
                task.tags = json.dumps(action["tags"])
        task.updated_at = datetime.utcnow()
        set_completion_state(task, task.completed, task.updated_at)
        return {"type": kind, "id": task.id, "title": task.title}

    if kind == "create_todo":
        priority = action.get("priority", "Medium")
        if priority not in {"Low", "Medium", "High"}:
            priority = "Medium"
        todo_date = date.today()
        if action.get("todo_date"):
            try:
                todo_date = date.fromisoformat(str(action["todo_date"]))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid todo date")
        todo = models.DailyTodo(
            user_id=uid,
            title=str(action.get("title", "")).strip(),
            notes=str(action.get("notes", "") or "").strip(),
            todo_date=todo_date,
            priority=priority,
            completed=bool(action.get("completed", False)),
        )
        if not todo.title:
            raise HTTPException(status_code=400, detail="AI todo title was empty")
        set_completion_state(todo, todo.completed)
        db.add(todo)
        db.flush()
        return {"type": kind, "id": todo.id, "title": todo.title, "todo_date": todo.todo_date.isoformat()}

    if kind in {"update_todo", "complete_todo", "delete_todo"}:
        todo = _find_todo(db, uid, action.get("target"))
        if not todo:
            raise HTTPException(status_code=404, detail=f"Todo not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_todo":
            title = todo.title
            _stop_timer_for_item(db, uid, todo_id=todo.id)
            now = datetime.utcnow()
            todo.deleted_at = now
            todo.updated_at = now
            db.query(models.TimeSession).filter(
                models.TimeSession.user_id == uid,
                models.TimeSession.todo_id == todo.id,
                models.TimeSession.deleted_at.is_(None),
            ).update({models.TimeSession.deleted_at: now}, synchronize_session=False)
            return {"type": kind, "id": todo.id, "title": title}
        if kind == "complete_todo":
            _stop_timer_for_item(db, uid, todo_id=todo.id)
            todo.completed = True
        else:
            for key in ("title", "notes"):
                if key in action and action[key] is not None:
                    setattr(todo, key, action[key])
            if "priority" in action:
                priority = str(action["priority"])
                if priority not in {"Low", "Medium", "High"}:
                    raise HTTPException(status_code=400, detail="Todo priority must be Low, Medium, or High")
                todo.priority = priority
            if action.get("todo_date"):
                todo.todo_date = date.fromisoformat(str(action["todo_date"]))
        todo.updated_at = datetime.utcnow()
        set_completion_state(todo, todo.completed, todo.updated_at)
        return {"type": kind, "id": todo.id, "title": todo.title}

    if kind == "create_habit":
        habit = models.Habit(
            user_id=uid,
            name=str(action.get("name", "")).strip(),
            description=str(action.get("description", "") or "").strip(),
            category="personal",
            frequency="daily",
            target_count=1,
            duration_days=max(1, min(int(action.get("duration_days") or 21), 365)),
            icon="fas fa-check-circle",
        )
        if not habit.name:
            raise HTTPException(status_code=400, detail="AI habit name was empty")
        db.add(habit)
        db.flush()
        return {"type": kind, "id": habit.id, "name": habit.name}

    if kind in {"check_in_habit", "delete_habit"}:
        habit = _find_habit(db, uid, action.get("target"))
        if not habit:
            raise HTTPException(status_code=404, detail=f"Habit not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_habit":
            name = habit.name
            now = datetime.utcnow()
            habit.deleted_at = now
            db.query(models.HabitEntry).filter(
                models.HabitEntry.user_id == uid,
                models.HabitEntry.habit_id == habit.id,
                models.HabitEntry.deleted_at.is_(None),
            ).update({models.HabitEntry.deleted_at: now}, synchronize_session=False)
            return {"type": kind, "id": habit.id, "name": name}
        habit = get_habit_for_check_in(db, habit.id, uid)
        _, review_required = check_in_habit(db, habit, uid)
        return {
            "type": kind,
            "id": habit.id,
            "name": habit.name,
            "review_required": review_required,
            "duration_days": habit.duration_days,
        }

    if kind == "create_challenge":
        challenge_type = str(action.get("challenge_type", "")).lower()
        if challenge_type != "reading":
            raise HTTPException(status_code=400, detail="Challenge type must be reading")
        title = str(action.get("title") or "").strip()
        book_type = str(action.get("book_type") or "").strip().lower()
        daily_goal = str(action.get("daily_goal") or "").strip()
        if not title or not daily_goal or action.get("duration") in (None, ""):
            raise HTTPException(status_code=400, detail="Book title, duration, and daily goal are required")
        if book_type not in {"fiction", "non_fiction"}:
            raise HTTPException(status_code=400, detail="Book type must be fiction or non_fiction")
        duration = max(1, min(int(action["duration"]), 365))
        challenge = models.Challenge(
            user_id=uid,
            title=title,
            description=f"Daily goal: {daily_goal}",
            duration=duration,
            challenge_type=challenge_type,
            book_type=book_type,
            start_date=datetime.utcnow(),
            xp_reward=0,
            icon="fas fa-book-open",
        )
        db.add(challenge)
        db.flush()
        return {"type": kind, "id": challenge.id, "title": challenge.title, "challenge_type": challenge.challenge_type}

    if kind in {"check_in_challenge", "delete_challenge"}:
        challenge = _find_challenge(db, uid, action.get("target"))
        if not challenge:
            raise HTTPException(status_code=404, detail=f"Challenge not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_challenge":
            title = challenge.title
            challenge.deleted_at = datetime.utcnow()
            challenge.updated_at = challenge.deleted_at
            return {"type": kind, "id": challenge.id, "title": title}
        was_completed = challenge.completed
        now = datetime.utcnow()
        if challenge.last_check_in and challenge.last_check_in.date() == now.date():
            return {"type": kind, "id": challenge.id, "title": challenge.title, "already_checked_in": True}
        challenge.current_streak += 1
        challenge.best_streak = max(challenge.best_streak, challenge.current_streak)
        challenge.last_check_in = now
        challenge.progress = min(100.0, (challenge.current_streak / challenge.duration) * 100)
        if challenge.current_streak >= challenge.duration:
            challenge.completed = True
            challenge.is_active = False
        set_completion_state(challenge, challenge.completed, now)
        challenge.updated_at = now
        completed_now = challenge.completed and not was_completed
        if completed_now and current_user and background_tasks:
            background_tasks.add_task(
                send_challenge_completion_email,
                current_user.email,
                current_user.username,
                challenge.title,
                challenge.duration,
            )
        return {"type": kind, "id": challenge.id, "title": challenge.title, "completed_now": completed_now}

    if kind == "create_project":
        title = str(action.get("title") or "").strip()
        description = str(action.get("description") or "").strip()
        category = str(action.get("category") or "").strip()
        if not title or not description or not category:
            raise HTTPException(status_code=400, detail="Project title, description, and category are required")
        project = models.Project(
            user_id=uid,
            title=title[:200],
            description=description[:2000],
            category=category[:100],
            status="in_progress",
        )
        db.add(project)
        db.flush()
        return {"type": kind, "id": project.id, "title": project.title, "status": project.status}

    if kind in {"update_project", "delete_project"}:
        project = _find_project(db, uid, action.get("target"))
        if not project:
            raise HTTPException(status_code=404, detail=f"Project not found or target is ambiguous: {action.get('target')}")
        if kind == "delete_project":
            title = project.title
            project.deleted_at = datetime.utcnow()
            project.updated_at = project.deleted_at
            return {"type": kind, "id": project.id, "title": title}
        was_complete = project.status == "complete"
        if "title" in action and str(action["title"]).strip():
            project.title = str(action["title"]).strip()[:200]
        if "description" in action:
            project.description = str(action["description"] or "").strip()[:2000]
        if "category" in action and str(action["category"]).strip():
            project.category = str(action["category"]).strip()[:100]
        if "status" in action:
            project_status = str(action["status"]).strip().lower()
            if project_status not in {"in_progress", "under_review", "complete"}:
                raise HTTPException(status_code=400, detail="Invalid project status")
            project.status = project_status
        project.updated_at = datetime.utcnow()
        set_completion_state(project, project.status == "complete", project.updated_at)
        completed_now = project.status == "complete" and not was_complete
        if completed_now and current_user and background_tasks:
            background_tasks.add_task(
                send_project_completion_email,
                current_user.email,
                current_user.username,
                project.title,
            )
        return {"type": kind, "id": project.id, "title": project.title, "status": project.status, "completed_now": completed_now}

    if kind == "start_timer":
        active = db.query(models.TimeSession).filter(models.TimeSession.user_id == uid, models.TimeSession.ended_at.is_(None), models.TimeSession.deleted_at.is_(None)).first()
        if active:
            raise HTTPException(status_code=409, detail="A timer is already running. Stop it first.")
        item_type = action.get("item_type")
        if item_type == "task":
            task = _find_task(db, uid, action.get("target"))
            if not task or task.completed:
                raise HTTPException(status_code=404, detail="Active task not found or target is ambiguous")
            if task.status == "Not Started":
                task.status = "In Progress"
            session = models.TimeSession(user_id=uid, item_type="task", task_id=task.id, started_at=datetime.utcnow())
            label = task.title
        elif item_type == "todo":
            todo = _find_todo(db, uid, action.get("target"))
            if not todo or todo.completed:
                raise HTTPException(status_code=404, detail="Active todo not found or target is ambiguous")
            session = models.TimeSession(user_id=uid, item_type="todo", todo_id=todo.id, started_at=datetime.utcnow())
            label = todo.title
        else:
            raise HTTPException(status_code=400, detail="Timer item type must be task or todo")
        db.add(session)
        db.flush()
        return {"type": kind, "session_id": session.id, "item_type": item_type, "title": label}

    if kind == "stop_timer":
        return _stop_active_timer(db, uid)

    if kind == "open_focus_timer":
        minutes = max(1, min(int(action.get("minutes") or 25), 180))
        return {"type": kind, "title": f"{minutes}-minute Pomodoro", "navigate_to": "/focus-timer", "minutes": minutes, "autostart": True}

    raise HTTPException(status_code=400, detail="Unsupported AI action")


@router.post("/ask", response_model=AIConversationOut)
async def ask_ai(
    data: AIQuestionCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat_id = (data.chat_id or uuid.uuid4().hex).strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", chat_id):
        raise HTTPException(status_code=400, detail="Invalid chat session")
    context = _context(db, current_user.id)
    context["ui"] = _safe_ui_context(data.context or {})
    history = db.query(models.AIConversation).filter(
        models.AIConversation.user_id == current_user.id,
        models.AIConversation.chat_id == chat_id,
    ).order_by(models.AIConversation.created_at.desc()).limit(12).all()

    submitted_context = data.context if isinstance(data.context, dict) else {}
    is_workflow_reply = "workflow_values" in submitted_context or bool(submitted_context.get("workflow_cancelled"))
    requested_workflow = None if is_workflow_reply else detect_workflow(data.question)
    previous_workflow = None
    if history and isinstance(history[0].context, dict):
        candidate = history[0].context.get("workflow")
        if isinstance(candidate, dict) and candidate.get("active"):
            previous_workflow = json.loads(json.dumps(candidate))

    # A fresh creation request always replaces an unfinished setup. This keeps
    # the latest message authoritative instead of replaying the previous action.
    if requested_workflow:
        workflow = start_workflow(requested_workflow)
        prompt = form_prompt(workflow, context)
        return _save_ai_turn(
            db,
            uid=current_user.id,
            chat_id=chat_id,
            question=data.question,
            answer=_workflow_reply(prompt, started=True),
            context={**context, "workflow": workflow, "form_prompt": prompt, "executed_actions": []},
        )

    if previous_workflow:
        if submitted_context.get("workflow_cancelled") or data.question.strip().lower() in {"cancel", "cancel setup", "stop setup"}:
            previous_workflow["active"] = False
            previous_workflow["cancelled"] = True
            return _save_ai_turn(
                db,
                uid=current_user.id,
                chat_id=chat_id,
                question=data.question,
                answer="Setup cancelled. Tell me what you would like to do next.",
                context={**context, "workflow": previous_workflow, "executed_actions": []},
            )
        submitted_values = submitted_context.get("workflow_values")
        if not isinstance(submitted_values, dict):
            prompt = form_prompt(previous_workflow, context)
            return _save_ai_turn(
                db,
                uid=current_user.id,
                chat_id=chat_id,
                question=data.question,
                answer="Use the quick details card below so I can collect everything together.",
                context={**context, "workflow": previous_workflow, "form_prompt": prompt, "executed_actions": []},
            )
        accepted, errors = accept_values(previous_workflow, submitted_values, context)
        if not accepted:
            prompt = form_prompt(previous_workflow, context, errors)
            return _save_ai_turn(
                db,
                uid=current_user.id,
                chat_id=chat_id,
                question=data.question,
                answer=_workflow_reply(prompt),
                context={**context, "workflow": previous_workflow, "form_prompt": prompt, "executed_actions": []},
            )
        action = build_action(previous_workflow)
        try:
            executed = [_execute_action(action, db, current_user.id, current_user, background_tasks)]
            previous_workflow["active"] = False
            return _save_ai_turn(
                db,
                uid=current_user.id,
                chat_id=chat_id,
                question=data.question,
                answer=_natural_action_reply(executed),
                context={**context, "workflow": previous_workflow, "requested_actions": [action], "executed_actions": executed},
            )
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            logger.exception("Guided AI action execution failed")
            raise HTTPException(status_code=500, detail="The guided action could not be completed safely") from exc

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": "App context:\n" + json.dumps(context, default=str)[:16000]},
    ]
    for item in reversed(history):
        messages.append({"role": "user", "content": item.question})
        messages.append({"role": "assistant", "content": json.dumps({"reply": item.answer, "actions": [], "history_status": "completed; do not repeat"})})
    messages.append({"role": "user", "content": data.question})

    raw_plan = await _ask(messages)
    try:
        plan = _json_plan(raw_plan)
    except HTTPException:
        repair_messages = messages + [
            {"role": "assistant", "content": raw_plan},
            {"role": "user", "content": "Return the same answer again as one valid JSON object with only reply and actions."},
        ]
        plan = _json_plan(await _ask(repair_messages))

    guided_kind = next(
        (GUIDED_ACTION_TYPES[action["type"]] for action in plan["actions"] if action["type"] in GUIDED_ACTION_TYPES),
        None,
    )
    if guided_kind:
        workflow = start_workflow(guided_kind)
        prompt = form_prompt(workflow, context)
        return _save_ai_turn(
            db,
            uid=current_user.id,
            chat_id=chat_id,
            question=data.question,
            answer=_workflow_reply(prompt, started=True),
            context={**context, "workflow": workflow, "form_prompt": prompt, "executed_actions": []},
        )

    executed = []
    try:
        for action in plan["actions"]:
            executed.append(_execute_action(action, db, current_user.id, current_user, background_tasks))
        final_context = {**context, "requested_actions": plan["actions"], "executed_actions": executed}
        answer = _natural_action_reply(executed) if executed else plan["reply"]
        obj = models.AIConversation(
            user_id=current_user.id,
            chat_id=chat_id,
            question=data.question,
            answer=answer,
            context=final_context,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("AI action execution failed")
        raise HTTPException(status_code=500, detail="AI action could not be completed safely") from exc


@router.get("/conversations", response_model=List[AIConversationOut])
def conversations(
    limit: int = 20,
    chat_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.AIConversation).filter(models.AIConversation.user_id == current_user.id)
    if chat_id:
        query = query.filter(models.AIConversation.chat_id == chat_id)
    return query.order_by(models.AIConversation.created_at.desc()).limit(max(1, min(limit, 100))).all()


@router.get("/chats", response_model=List[AIChatOut])
def chats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(models.AIConversation).filter(
        models.AIConversation.user_id == current_user.id,
    ).order_by(models.AIConversation.created_at.desc()).limit(200).all()
    grouped: dict[str, dict] = {}
    for row in rows:
        chat = grouped.get(row.chat_id)
        if not chat:
            grouped[row.chat_id] = {
                "chat_id": row.chat_id,
                "title": row.question.strip()[:80] or "New chat",
                "updated_at": row.created_at,
                "message_count": 1,
            }
        else:
            chat["message_count"] += 1
    return list(grouped.values())


@router.get("/status")
def status(current_user: models.User = Depends(get_current_user)):
    del current_user
    return {
        "ready": bool(GROQ_API_KEY),
        "model": GROQ_MODEL if GROQ_API_KEY else None,
        "message": "AI is ready" if GROQ_API_KEY else "AI is not configured. Set GROQ_API_KEY on the backend.",
    }


@router.post("/feedback")
def feedback(
    data: AIFeedback,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obj = db.query(models.AIConversation).filter(
        models.AIConversation.id == data.conversation_id,
        models.AIConversation.user_id == current_user.id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Conversation not found")
    obj.feedback = data.feedback
    db.commit()
    return {"message": "Feedback saved"}
