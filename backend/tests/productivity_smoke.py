import json
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app import database, models
from app.main import app
from app.routers import ai_assistant as ai_router
from app.routers import auth as auth_router

client = TestClient(app)


def expect(response, status_code):
    assert response.status_code == status_code, (
        f"{response.request.method} {response.request.url}: "
        f"{response.status_code} {response.text}"
    )
    return response


password = "FocusPass9!"
email = "focus-ci@example.com"
captured_verification = {}


def capture_verification_email(to_email, username, token, expires_minutes):
    captured_verification["token"] = token
    return True


auth_router.send_verification_email = capture_verification_email
auth_router.send_welcome_email = lambda *_args, **_kwargs: True
expect(
    client.post(
        "/auth/register",
        json={"username": "focus-ci-user", "email": email, "password": password},
    ),
    201,
)
assert client.post("/auth/login", json={"email": email, "password": password}).status_code == 403
verify = client.get(
    f"/auth/verify-email?token={captured_verification['token']}",
    follow_redirects=False,
)
assert verify.status_code == 303
login = expect(client.post("/auth/login", json={"email": email, "password": password}), 200).json()
headers = {"Authorization": f"Bearer {login['access_token']}"}

# Daily todos persist and can be completed.
todo = expect(
    client.post(
        "/api/productivity/todos",
        headers=headers,
        json={
            "title": "Review lecture notes",
            "notes": "Focus smoke test",
            "todo_date": "2026-08-09",
            "completed": True,
            "priority": "High",
        },
    ),
    201,
).json()
assert todo["time_spent_seconds"] == 0
assert todo["completed"] is False

todos = expect(
    client.get("/api/productivity/todos?todo_date=2026-08-09", headers=headers),
    200,
).json()
assert any(item["id"] == todo["id"] for item in todos)

started_todo_timer = expect(
    client.post(
        "/api/productivity/timer/start",
        headers=headers,
        json={"item_type": "todo", "item_id": todo["id"]},
    ),
    201,
).json()
assert started_todo_timer["todo_id"] == todo["id"]
assert started_todo_timer["started_at"].endswith(("Z", "+00:00"))
active = expect(client.get("/api/productivity/timer/active", headers=headers), 200).json()
assert active["id"] == started_todo_timer["id"]

conflict = client.post(
    "/api/productivity/timer/start",
    headers=headers,
    json={"item_type": "todo", "item_id": todo["id"]},
)
assert conflict.status_code == 409

stopped_todo_timer = expect(
    client.post("/api/productivity/timer/stop", headers=headers, json={}),
    200,
).json()
assert stopped_todo_timer["elapsed_seconds"] >= 1
refreshed_todo = expect(
    client.get("/api/productivity/todos?todo_date=2026-08-09", headers=headers),
    200,
).json()[0]
assert refreshed_todo["time_spent_seconds"] >= 1

# Resuming creates a new session, and completing an active todo saves that session first.
expect(
    client.post(
        "/api/productivity/timer/start",
        headers=headers,
        json={"item_type": "todo", "item_id": todo["id"]},
    ),
    201,
)
completed_todo = expect(
    client.put(
        f"/api/productivity/todos/{todo['id']}",
        headers=headers,
        json={"completed": True},
    ),
    200,
).json()
assert completed_todo["completed"] is True
assert completed_todo["time_spent_seconds"] > refreshed_todo["time_spent_seconds"]
assert expect(client.get("/api/productivity/timer/active", headers=headers), 200).json() is None
assert client.post(
    "/api/productivity/timer/start",
    headers=headers,
    json={"item_type": "todo", "item_id": todo["id"]},
).status_code == 400

task = expect(
    client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Timed study task",
            "completed": True,
            "status": "Completed",
            "priority": "Medium",
            "due_date": "2026-08-10T18:30:00",
            "time_estimate": 25,
        },
    ),
    201,
).json()
assert task["completed"] is False
assert task["status"] == "Not Started"
expect(
    client.post(
        "/api/productivity/timer/start",
        headers=headers,
        json={"item_type": "task", "item_id": task["id"]},
    ),
    201,
)
expect(client.post("/api/productivity/timer/stop", headers=headers, json={}), 200)
tracked_task = expect(client.get(f"/api/tasks/{task['id']}", headers=headers), 200).json()
assert tracked_task["time_spent_seconds"] >= 1
assert tracked_task["status"] == "In Progress"

# Creation requests collect every detail in one friendly card and submit once.
guided_task = expect(client.post("/api/ai/ask", headers=headers, json={"question": "Create a task", "chat_id": "guided-replacement"}), 200).json()
assert [field["key"] for field in guided_task["context"]["form_prompt"]["fields"]] == [
    "title", "description", "priority", "due_date", "due_time", "time_estimate", "tags"
]
incomplete_task = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={
            "question": "Use these details to create a task.",
            "chat_id": "guided-replacement",
            "context": {"workflow_values": {"title": "One-submit AI task"}},
        },
    ),
    200,
).json()
assert set(incomplete_task["context"]["form_prompt"]["errors"]) == {"priority", "due_date", "due_time"}
completed_task = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={
            "question": "Use these details to create a task.",
            "chat_id": "guided-replacement",
            "context": {
                "workflow_values": {
                    "title": "One-submit AI task",
                    "description": "Collected together",
                    "priority": "High",
                    "due_date": "2026-08-12",
                    "due_time": "14:30",
                    "time_estimate": 30,
                    "tags": "ai, friendly",
                }
            },
        },
    ),
    200,
).json()
assert completed_task["context"]["executed_actions"][0]["title"] == "One-submit AI task"

# A newer creation request still replaces any unfinished setup.
guided_habit = expect(client.post("/api/ai/ask", headers=headers, json={"question": "Create a habit", "chat_id": "guided-replacement"}), 200).json()
assert guided_habit["context"]["workflow"]["type"] == "habit"
expect(client.post("/api/ai/ask", headers=headers, json={"question": "Cancel setup", "chat_id": "guided-replacement", "context": {"workflow_cancelled": True}}), 200)

# Provider-action execution is tested below independently from the guided collector.
ai_router.GUIDED_ACTION_TYPES = {}
async def fake_create(_messages):
    return json.dumps(
        {
            "reply": "I can add that for you.",
            "actions": [
                {
                    "type": "create_task",
                    "title": "AI-created revision task",
                    "description": "Created through the chatbot action pipeline",
                    "priority": "High",
                    "due_date": "2026-08-11T16:00:00",
                    "time_estimate": 45,
                    "tags": ["study", "ai"],
                },
                {
                    "type": "create_todo",
                    "title": "AI daily todo",
                    "todo_date": "2026-08-09",
                    "priority": "Medium",
                },
            ],
        }
    )


ai_router._ask = fake_create
conversation = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={"question": "Carry out this prepared task and Todo action plan."},
    ),
    200,
).json()
executed = conversation["context"]["executed_actions"]
assert [item["type"] for item in executed] == ["create_task", "create_todo"]
assert conversation["answer"] == 'Done — I created the task “AI-created revision task” and added the Todo “AI daily todo”.'
assert "Done:" not in conversation["answer"]

all_tasks = expect(client.get("/api/tasks", headers=headers), 200).json()
created_ai_task = next(item for item in all_tasks if item["title"] == "AI-created revision task")
assert created_ai_task["completed"] is False
assert created_ai_task["status"] == "Not Started"
all_todos = expect(
    client.get("/api/productivity/todos?todo_date=2026-08-09", headers=headers),
    200,
).json()
created_ai_todo = next(item for item in all_todos if item["title"] == "AI daily todo")
assert created_ai_todo["completed"] is False

# The chatbot can modify productivity data and create active routines without starting timers.
async def fake_manage(_messages):
    return json.dumps(
        {
            "reply": "I updated your plan and started tracking it.",
            "actions": [
                {
                    "type": "update_task",
                    "target": "AI-created revision task",
                    "priority": "Low",
                    "time_estimate": 30,
                },
                {"type": "complete_todo", "target": "AI daily todo"},
                {
                    "type": "create_habit",
                    "name": "Read 20 minutes",
                    "description": "Daily reading habit",
                    "target_count": 1,
                },
                {
                    "type": "create_challenge",
                    "challenge_type": "reading",
                    "title": "AI reading challenge",
                    "book_type": "fiction",
                    "duration": 7,
                    "daily_goal": "20 pages",
                },
                {
                    "type": "create_project",
                    "title": "AI portfolio project",
                    "description": "Prepare the launch",
                    "category": "Software Development",
                    "status": "complete",
                },
            ],
        }
    )


ai_router._ask = fake_manage
managed = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={"question": "Carry out the prepared multi-item workspace action plan."},
    ),
    200,
).json()
assert [item["type"] for item in managed["context"]["executed_actions"]] == [
    "update_task",
    "complete_todo",
    "create_habit",
    "create_challenge",
    "create_project",
]

updated_task = next(
    item for item in expect(client.get("/api/tasks", headers=headers), 200).json()
    if item["title"] == "AI-created revision task"
)
assert updated_task["priority"] == "Low"
assert updated_task["time_estimate"] == 30
updated_todo = next(
    item for item in expect(
        client.get("/api/productivity/todos?todo_date=2026-08-09", headers=headers),
        200,
    ).json()
    if item["title"] == "AI daily todo"
)
assert updated_todo["completed"] is True

assert expect(client.get("/api/productivity/timer/active", headers=headers), 200).json() is None
expect(
    client.post(
        "/api/productivity/timer/start",
        headers=headers,
        json={"item_type": "task", "item_id": updated_task["id"]},
    ),
    201,
)

# The chatbot can stop a user-started timer and check in user-owned routines/challenges.
async def fake_check_in(_messages):
    return json.dumps(
        {
            "reply": "Timer saved and your progress is checked in.",
            "actions": [
                {"type": "stop_timer"},
                {"type": "check_in_habit", "target": "Read 20 minutes"},
                {"type": "check_in_challenge", "target": "AI reading challenge"},
            ],
        }
    )


ai_router._ask = fake_check_in
checked = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={"question": "Stop my timer and check in my reading habit and challenge."},
    ),
    200,
).json()
assert [item["type"] for item in checked["context"]["executed_actions"]] == [
    "stop_timer",
    "check_in_habit",
    "check_in_challenge",
]
assert expect(client.get("/api/productivity/timer/active", headers=headers), 200).json() is None

habits = expect(client.get("/api/habits", headers=headers), 200).json()
reading_habit = next(item for item in habits if item["name"] == "Read 20 minutes")
assert reading_habit["completed"] is False
habit_entries = expect(client.get("/api/habits/entries", headers=headers), 200).json()
assert any(item["habit_id"] == reading_habit["id"] and item["completed"] for item in habit_entries)

challenges = expect(client.get("/api/challenges", headers=headers), 200).json()
reading_challenge = next(item for item in challenges if item["title"] == "AI reading challenge")
assert reading_challenge["completed"] is False
assert reading_challenge["is_active"] is True
assert reading_challenge["current_streak"] == 1
assert reading_challenge["progress"] > 0
assert reading_challenge["book_type"] == "fiction"
projects = expect(client.get("/api/projects", headers=headers), 200).json()
portfolio_project = next(item for item in projects if item["title"] == "AI portfolio project")
assert portfolio_project["category"] == "Software Development"
assert portfolio_project["status"] == "in_progress"

sessions = expect(client.get("/api/productivity/timer/sessions", headers=headers), 200).json()
assert len(sessions) >= 3

with database.SessionLocal() as archive_db:
    archived_todo_row = archive_db.query(models.DailyTodo).filter(models.DailyTodo.id == todo["id"]).one()
    archived_todo_row.completed_at = datetime.utcnow() - timedelta(days=61)
    archive_db.commit()
archived_todos = expect(client.get("/api/productivity/todos", headers=headers), 200).json()
assert next(item for item in archived_todos if item["id"] == todo["id"])["archived_at"] is not None

expect(client.delete(f"/api/productivity/todos/{todo['id']}", headers=headers), 204)
assert all(item["id"] != todo["id"] for item in expect(client.get("/api/productivity/todos", headers=headers), 200).json())
with database.SessionLocal() as verification_db:
    deleted_todo = verification_db.query(models.DailyTodo).filter(models.DailyTodo.id == todo["id"]).one()
    assert deleted_todo.deleted_at is not None

print("Productivity and AI action smoke test passed")
