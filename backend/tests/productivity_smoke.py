import json

from fastapi.testclient import TestClient

from app.main import app
from app.routers import ai_assistant as ai_router

client = TestClient(app)


def expect(response, status_code):
    assert response.status_code == status_code, (
        f"{response.request.method} {response.request.url}: "
        f"{response.status_code} {response.text}"
    )
    return response


password = "FocusPass9!"
email = "focus-ci@example.com"

expect(
    client.post(
        "/auth/register",
        json={"username": "focus-ci-user", "email": email, "password": password},
    ),
    201,
)
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

# A running todo timer survives as server state and writes exact seconds on stop.
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

# Only one timer may run for a user at once.
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

# Task timing uses the same persistent timer and maintains second/minute compatibility.
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

# Exercise the action-capable AI without requiring a real Groq key in CI.
async def fake_ask(_messages):
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


ai_router._ask = fake_ask
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

sessions = expect(client.get("/api/productivity/timer/sessions", headers=headers), 200).json()
assert len(sessions) >= 2

print("Productivity and AI action smoke test passed")
