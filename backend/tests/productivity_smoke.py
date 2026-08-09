import json

from fastapi.testclient import TestClient

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
            "priority": "High",
        },
    ),
    201,
).json()
assert todo["time_spent_seconds"] == 0

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

completed_todo = expect(
    client.put(
        f"/api/productivity/todos/{todo['id']}",
        headers=headers,
        json={"completed": True},
    ),
    200,
).json()
assert completed_todo["completed"] is True

task = expect(
    client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Timed study task",
            "priority": "Medium",
            "time_estimate": 25,
        },
    ),
    201,
).json()
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

# The chatbot can create real task and todo records.
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
        json={"question": "Create a revision task and add a daily todo for me."},
    ),
    200,
).json()
executed = conversation["context"]["executed_actions"]
assert [item["type"] for item in executed] == ["create_task", "create_todo"]

all_tasks = expect(client.get("/api/tasks", headers=headers), 200).json()
assert any(item["title"] == "AI-created revision task" for item in all_tasks)
all_todos = expect(
    client.get("/api/productivity/todos?todo_date=2026-08-09", headers=headers),
    200,
).json()
assert any(item["title"] == "AI daily todo" for item in all_todos)

# The chatbot can modify productivity data, create routines and start a timer.
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
                    "duration": 7,
                    "daily_goal": "20 pages",
                },
                {
                    "type": "start_timer",
                    "item_type": "task",
                    "target": "AI-created revision task",
                },
            ],
        }
    )


ai_router._ask = fake_manage
managed = expect(
    client.post(
        "/api/ai/ask",
        headers=headers,
        json={"question": "Update my revision task, finish the todo, add a reading routine and start timing the task."},
    ),
    200,
).json()
assert [item["type"] for item in managed["context"]["executed_actions"]] == [
    "update_task",
    "complete_todo",
    "create_habit",
    "create_challenge",
    "start_timer",
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

active_ai_timer = expect(client.get("/api/productivity/timer/active", headers=headers), 200).json()
assert active_ai_timer["item_type"] == "task"
assert active_ai_timer["task_id"] == updated_task["id"]

# The chatbot can stop tracking and check in user-owned routines/challenges.
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
habit_entries = expect(client.get("/api/habits/entries", headers=headers), 200).json()
assert any(item["habit_id"] == reading_habit["id"] and item["completed"] for item in habit_entries)

challenges = expect(client.get("/api/challenges", headers=headers), 200).json()
reading_challenge = next(item for item in challenges if item["title"] == "AI reading challenge")
assert reading_challenge["current_streak"] == 1
assert reading_challenge["progress"] > 0

sessions = expect(client.get("/api/productivity/timer/sessions", headers=headers), 200).json()
assert len(sessions) >= 3

print("Productivity and AI action smoke test passed")
