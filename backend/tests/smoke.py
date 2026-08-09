from fastapi.testclient import TestClient

from app import database, models
from app.main import app
from app.routers import auth as auth_router


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

created_task = expect(
    client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Smoke test task",
            "description": "Created by CI",
            "priority": "High",
            "status": "Not Started",
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
        json={"name": "Read before bed", "frequency": "daily", "target_count": 1},
    ),
    201,
).json()
habit_id = habit["id"]

habit_check_in = expect(
    client.post(f"/api/habits/{habit_id}/check-in", headers=headers),
    200,
).json()
assert habit_check_in["completed"] is True

habit_entries = expect(
    client.get(f"/api/habits/entries?habit_id={habit_id}&days=30", headers=headers),
    200,
).json()
assert len(habit_entries) == 1

for challenge_type, title in (("reading", "Read Daily"), ("meditation", "Meditate Daily")):
    challenge = expect(
        client.post(
            "/api/challenges",
            headers=headers,
            json={"title": title, "duration": 21, "challenge_type": challenge_type},
        ),
        201,
    ).json()
    checked = expect(
        client.post(f"/api/challenges/check-in/{challenge['id']}", headers=headers),
        200,
    ).json()
    assert checked["current_streak"] == 1
    assert checked["progress"] > 0

invalid_challenge = client.post(
    "/api/challenges",
    headers=headers,
    json={"title": "Unsupported", "duration": 21, "challenge_type": "diet"},
)
assert invalid_challenge.status_code == 422

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

expect(client.delete(f"/api/tasks/{task_id}", headers=headers), 204)
expect(
    client.post(
        "/auth/delete-account",
        headers=headers,
        json={"password": new_password, "confirm_phrase": "DELETE"},
    ),
    200,
)

print("Backend API smoke test passed")
