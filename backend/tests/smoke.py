import os
from datetime import datetime, timedelta

# The smoke suite must never use developer or deployment provider credentials
# loaded from backend/.env. Email delivery is captured below and AI is expected
# to report that no provider is configured.
os.environ["BREVO_SMTP_LOGIN"] = ""
os.environ["BREVO_SMTP_KEY"] = ""
os.environ["SENDER_EMAIL"] = ""
os.environ["ADMIN_EMAIL"] = ""
os.environ["GROQ_API_KEY"] = ""

from fastapi.testclient import TestClient

from app import database, models
from app.main import app
from app.routers import auth as auth_router
from app.routers import challenges as challenges_router
from app.routers import habits as habits_router
from app.routers import projects as projects_router


models.Base.metadata.drop_all(bind=database.engine)
models.Base.metadata.create_all(bind=database.engine)

client = TestClient(app)

def expect(response, status_code):
    assert response.status_code == status_code, (
        f"{response.request.method} {response.request.url}: "
        f"{response.status_code} {response.text}"
    )
    return response


# Registration and authentication now require Brevo email verification.
password = "StrongPass1!"
reset_password = "ResetPass2!"
new_password = "ChangedPass3!"
captured_verification = {}


def capture_verification_email(to_email, username, token, expires_minutes):
    captured_verification["to_email"] = to_email
    captured_verification["token"] = token
    captured_verification["expires_minutes"] = expires_minutes
    return True


auth_router.send_verification_email = capture_verification_email
auth_router.send_welcome_email = lambda *_args, **_kwargs: True
register = expect(
    client.post(
        "/auth/register",
        json={"username": "ci-user", "email": "ci@example.com", "password": password},
    ),
    201,
)
assert register.json()["email"] == "ci@example.com"
assert captured_verification["to_email"] == "ci@example.com"
assert captured_verification["token"]
assert client.post(
    "/auth/login", json={"email": "ci@example.com", "password": password}
).status_code == 403

verify = client.get(
    f"/auth/verify-email?token={captured_verification['token']}",
    follow_redirects=False,
)
assert verify.status_code == 303
assert "verified=1" in verify.headers["location"]

login = expect(
    client.post("/auth/login", json={"email": "ci@example.com", "password": password}),
    200,
)
token = login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

expect(client.get("/auth/me", headers=headers), 200)
expect(client.post("/auth/verify-token", headers=headers), 200)

# Password reset is app-managed and sends through the configured email service.
captured_reset = {}


def capture_reset_email(to_email, username, token, expires_minutes):
    captured_reset["to_email"] = to_email
    captured_reset["token"] = token
    captured_reset["expires_minutes"] = expires_minutes
    return True


auth_router.send_password_reset_email = capture_reset_email
forgot = expect(
    client.post("/auth/forgot-password", json={"email": "ci@example.com"}),
    200,
)
assert "If an account exists" in forgot.json()["message"]
assert captured_reset["to_email"] == "ci@example.com"
assert captured_reset["token"]

expect(
    client.post(
        "/auth/reset-password",
        json={"token": captured_reset["token"], "new_password": reset_password},
    ),
    200,
)
assert client.get("/auth/me", headers=headers).status_code == 401
assert client.post(
    "/auth/login", json={"email": "ci@example.com", "password": password}
).status_code == 401
reset_login = expect(
    client.post(
        "/auth/login",
        json={"email": "ci@example.com", "password": reset_password},
    ),
    200,
)
headers = {"Authorization": f"Bearer {reset_login.json()['access_token']}"}

assert client.post(
    "/auth/reset-password",
    json={"token": captured_reset["token"], "new_password": "AnotherPass4!"},
).status_code == 400

profile = expect(
    client.put(
        "/auth/profile",
        headers=headers,
        json={
            "city": "Johannesburg",
            "country": "South Africa",
            "bio": "CI smoke test profile",
        },
    ),
    200,
)
assert profile.json()["city"] == "Johannesburg"

profile_picture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlS8AAAAASUVORK5CYII="
saved_picture = expect(
    client.put(
        "/auth/profile",
        headers=headers,
        json={"profile_picture": profile_picture},
    ),
    200,
).json()
assert saved_picture["profile_picture"] == profile_picture
assert expect(client.get("/auth/profile", headers=headers), 200).json()["profile_picture"] == profile_picture

missing_task_schedule = client.post(
    "/api/tasks",
    headers=headers,
    json={"title": "Incomplete task setup", "priority": "Medium"},
)
assert missing_task_schedule.status_code == 422

created_task = expect(
    client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Smoke test task",
            "description": "Created by CI",
            "priority": "High",
            "status": "Not Started",
            "due_date": "2026-08-10T17:00:00",
            "tags": ["ci"],
            "time_estimate": 30,
        },
    ),
    201,
).json()
task_id = created_task["id"]
assert created_task["tags"] == ["ci"]

listed_tasks = expect(client.get("/api/tasks", headers=headers), 200).json()
assert any(task["id"] == task_id for task in listed_tasks)

updated_task = expect(
    client.put(
        f"/api/tasks/{task_id}",
        headers=headers,
        json={"status": "Completed", "time_spent": 25},
    ),
    200,
).json()
assert updated_task["completed"] is True
assert updated_task["time_spent"] == 25

analytics = expect(client.get("/api/analytics/", headers=headers), 200).json()
assert analytics["total_tasks"] == 1
assert analytics["completed_tasks"] == 1

habit = expect(
    client.post(
        "/api/habits",
        headers=headers,
        json={"name": "Read before bed", "frequency": "daily", "duration_days": 21},
    ),
    201,
).json()
habit_id = habit["id"]
assert habit["duration_days"] == 21
assert habit["check_in_count"] == 0
assert habit["can_check_in"] is True

habit_check_in = expect(
    client.post(f"/api/habits/{habit_id}/check-in", headers=headers),
    200,
).json()
assert habit_check_in["entry"]["completed"] is True
assert habit_check_in["habit"]["check_in_count"] == 1
assert habit_check_in["habit"]["remaining_check_ins"] == 20
assert habit_check_in["review_required"] is False

# A second browser or direct request cannot bypass the rolling 24-hour cooldown.
cooldown = expect(client.post(f"/api/habits/{habit_id}/check-in", headers=headers), 429).json()
assert cooldown["detail"]["retry_after_seconds"] > 0
expect(
    client.post(
        "/api/habits/entries",
        headers=headers,
        json={"habit_id": habit_id, "date": "2026-08-09T06:00:00", "completed": True, "count": 1},
    ),
    405,
)

habit_entries = expect(
    client.get(f"/api/habits/entries?habit_id={habit_id}&days=30", headers=headers),
    200,
).json()
assert len(habit_entries) == 1

# A final check-in requires an explicit answer instead of auto-completing.
completed_email = {}
habits_router.send_habit_completion_email = lambda to_email, username, habit_name, duration_days: completed_email.update(
    {"to_email": to_email, "habit_name": habit_name, "duration_days": duration_days}
) or True
one_day_habit = expect(
    client.post(
        "/api/habits",
        headers=headers,
        json={"name": "One focused day", "frequency": "daily", "duration_days": 1},
    ),
    201,
).json()
final_check_in = expect(client.post(f"/api/habits/{one_day_habit['id']}/check-in", headers=headers), 200).json()
assert final_check_in["review_required"] is True
assert final_check_in["completion_email_queued"] is False
assert final_check_in["habit"]["completed"] is False
assert final_check_in["habit"]["completion_review_required"] is True

confirmed = expect(
    client.post(
        f"/api/habits/{one_day_habit['id']}/completion-review",
        headers=headers,
        json={"established": True},
    ),
    200,
).json()
assert confirmed["completed_now"] is True
assert confirmed["completion_email_queued"] is True
assert confirmed["habit"]["completed"] is True
assert confirmed["habit"]["completed_at"] is not None
assert completed_email == {"to_email": "ci@example.com", "habit_name": "One focused day", "duration_days": 1}
expect(client.post(f"/api/habits/{one_day_habit['id']}/check-in", headers=headers), 409)

# Saying “not yet” extends the plan and keeps completion false in the database.
needs_more = expect(
    client.post(
        "/api/habits",
        headers=headers,
        json={"name": "Needs more practice", "frequency": "daily", "duration_days": 1},
    ),
    201,
).json()
expect(client.post(f"/api/habits/{needs_more['id']}/check-in", headers=headers), 200)
extended = expect(
    client.post(
        f"/api/habits/{needs_more['id']}/completion-review",
        headers=headers,
        json={"established": False, "additional_days": 7},
    ),
    200,
).json()
assert extended["completed_now"] is False
assert extended["habit"]["completed"] is False
assert extended["habit"]["duration_days"] == 8
assert extended["habit"]["completion_review_required"] is False

challenge = expect(
    client.post(
        "/api/challenges",
        headers=headers,
        json={"title": "Atomic Habits", "description": "Daily goal: 20 pages", "duration": 21, "challenge_type": "reading", "book_type": "non_fiction"},
    ),
    201,
).json()
checked = expect(
    client.post(f"/api/challenges/check-in/{challenge['id']}", headers=headers),
    200,
).json()
assert checked["current_streak"] == 1
assert checked["progress"] > 0

challenge_email = {}
challenges_router.send_challenge_completion_email = lambda to_email, username, book_title, duration_days: challenge_email.update(
    {"to_email": to_email, "book_title": book_title, "duration_days": duration_days}
) or True
one_day_challenge = expect(
    client.post(
        "/api/challenges",
        headers=headers,
        json={"title": "The Last Chapter", "description": "Daily goal: finish it", "duration": 1, "challenge_type": "reading", "book_type": "fiction"},
    ),
    201,
).json()
completed_challenge = expect(client.post(f"/api/challenges/check-in/{one_day_challenge['id']}", headers=headers), 200).json()
assert completed_challenge["completed"] is True
assert challenge_email == {"to_email": "ci@example.com", "book_title": "The Last Chapter", "duration_days": 1}

missing_book_type = client.post(
    "/api/challenges",
    headers=headers,
    json={"title": "Missing type", "description": "Daily goal: 20 pages", "duration": 21, "challenge_type": "reading"},
)
assert missing_book_type.status_code == 422

invalid_challenge = client.post(
    "/api/challenges",
    headers=headers,
    json={"title": "Unsupported", "description": "Daily goal: 20 pages", "duration": 21, "challenge_type": "meditation", "book_type": "fiction"},
)
assert invalid_challenge.status_code == 422

category = expect(
    client.post("/api/projects/categories", headers=headers, json={"name": "Event Planning"}),
    201,
).json()
assert category["name"] == "Event Planning"
project = expect(
    client.post(
        "/api/projects",
        headers=headers,
        json={"title": "Launch event", "category": category["name"], "status": "in_progress"},
    ),
    201,
).json()
assert project["status"] == "in_progress"
project = expect(
    client.put(f"/api/projects/{project['id']}", headers=headers, json={"status": "under_review"}),
    200,
).json()
assert project["status"] == "under_review"

project_email = {}
projects_router.send_project_completion_email = lambda to_email, username, project_title: project_email.update(
    {"to_email": to_email, "project_title": project_title}
) or True
project = expect(
    client.put(f"/api/projects/{project['id']}", headers=headers, json={"status": "complete"}),
    200,
).json()
assert project["status"] == "complete"
assert project_email == {"to_email": "ci@example.com", "project_title": "Launch event"}

ai_without_key = client.post(
    "/api/ai/ask",
    headers=headers,
    json={"question": "What should I do next?"},
)
assert ai_without_key.status_code == 503

contact = expect(
    client.post(
        "/api/contact/",
        json={
            "firstName": "CI",
            "lastName": "Tester",
            "email": "contact@example.com",
            "phone": "+27123456789",
            "message": "This is a CI smoke test contact message.",
        },
    ),
    201,
)
assert contact.json()["success"] is True

old_headers = headers
expect(
    client.post(
        "/auth/change-password",
        headers=headers,
        json={"current_password": reset_password, "new_password": new_password},
    ),
    200,
)
assert client.get("/auth/me", headers=old_headers).status_code == 401
assert client.post(
    "/auth/login", json={"email": "ci@example.com", "password": reset_password}
).status_code == 401
new_login = expect(
    client.post(
        "/auth/login",
        json={"email": "ci@example.com", "password": new_password},
    ),
    200,
)
headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}

email_change = expect(
    client.post(
        "/auth/change-email",
        headers=headers,
        json={"new_email": "ci-new@example.com", "password": new_password},
    ),
    200,
).json()
headers = {"Authorization": f"Bearer {email_change['access_token']}"}
expect(client.get("/auth/me", headers=headers), 200)

# Completed workspace items move into the account archive after 60 days.
archive_cutoff_item_time = datetime.utcnow() - timedelta(days=61)
with database.SessionLocal() as archive_db:
    archived_task_row = archive_db.query(models.Task).filter(models.Task.id == task_id).one()
    archived_task_row.completed_at = archive_cutoff_item_time
    archived_habit_row = archive_db.query(models.Habit).filter(models.Habit.id == one_day_habit["id"]).one()
    archived_habit_row.completed_at = archive_cutoff_item_time
    archived_challenge_row = archive_db.query(models.Challenge).filter(models.Challenge.id == challenge["id"]).one()
    archived_challenge_row.completed = True
    archived_challenge_row.is_active = False
    archived_challenge_row.completed_at = archive_cutoff_item_time
    archived_project_row = archive_db.query(models.Project).filter(models.Project.id == project["id"]).one()
    archived_project_row.status = "complete"
    archived_project_row.completed_at = archive_cutoff_item_time
    archive_db.commit()

archived_tasks = expect(client.get("/api/tasks", headers=headers), 200).json()
archived_habits = expect(client.get("/api/habits", headers=headers), 200).json()
archived_challenges = expect(client.get("/api/challenges", headers=headers), 200).json()
archived_projects = expect(client.get("/api/projects", headers=headers), 200).json()
assert next(item for item in archived_tasks if item["id"] == task_id)["archived_at"] is not None
assert next(item for item in archived_habits if item["id"] == one_day_habit["id"])["archived_at"] is not None
assert next(item for item in archived_challenges if item["id"] == challenge["id"])["archived_at"] is not None
assert next(item for item in archived_projects if item["id"] == project["id"])["archived_at"] is not None

expect(client.delete(f"/api/tasks/{task_id}", headers=headers), 204)
expect(client.delete(f"/api/habits/{habit['id']}", headers=headers), 204)
expect(client.delete(f"/api/challenges/{challenge['id']}", headers=headers), 204)
expect(client.delete(f"/api/projects/{project['id']}", headers=headers), 204)
assert all(item["id"] != task_id for item in expect(client.get("/api/tasks", headers=headers), 200).json())
with database.SessionLocal() as verification_db:
    assert verification_db.query(models.Task).filter(models.Task.id == task_id).one().deleted_at is not None
    assert verification_db.query(models.Habit).filter(models.Habit.id == habit["id"]).one().deleted_at is not None
    assert verification_db.query(models.Challenge).filter(models.Challenge.id == challenge["id"]).one().deleted_at is not None
    assert verification_db.query(models.Project).filter(models.Project.id == project["id"]).one().deleted_at is not None
expect(
    client.post(
        "/auth/delete-account",
        headers=headers,
        json={"password": new_password, "confirm_phrase": "DELETE"},
    ),
    200,
)
with database.SessionLocal() as verification_db:
    deleted_user = verification_db.query(models.User).filter(models.User.email == "ci-new@example.com").one()
    assert deleted_user.is_active is False
    assert deleted_user.deleted_at is not None

print("Backend API smoke test passed")
