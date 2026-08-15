from fastapi.testclient import TestClient

from app import database, models
from app.main import app
from app.routers import auth as auth_router

client = TestClient(app)


def expect(response, status_code):
    assert response.status_code == status_code, (
        f"{response.request.method} {response.request.url}: "
        f"{response.status_code} {response.text}"
    )
    return response


# Password registration must roll back when Brevo cannot accept the verification email.
auth_router.send_verification_email = lambda *_args, **_kwargs: False
failed = expect(
    client.post(
        "/auth/register",
        json={
            "username": "brevo-failure-user",
            "email": "brevo-failure@example.com",
            "password": "StrongPass7!",
        },
    ),
    503,
)
assert "verification email" in failed.json()["detail"].lower()
with database.SessionLocal() as db:
    assert db.query(models.User).filter(models.User.email == "brevo-failure@example.com").first() is None


# Successful registration creates an unverified account and a one-time token.
captured = {}


def capture_verification(to_email, username, token, expires_minutes):
    captured.update(
        {
            "to_email": to_email,
            "username": username,
            "token": token,
            "expires_minutes": expires_minutes,
        }
    )
    return True


auth_router.send_verification_email = capture_verification
auth_router.send_welcome_email = lambda *_args, **_kwargs: True
registration = expect(
    client.post(
        "/auth/register",
        json={
            "username": "verification-user",
            "email": "verification@example.com",
            "password": "StrongPass8!",
        },
    ),
    201,
).json()
assert registration["email"] == "verification@example.com"
assert captured["to_email"] == "verification@example.com"
assert captured["token"]

blocked_login = client.post(
    "/auth/login",
    json={"email": "verification@example.com", "password": "StrongPass8!"},
)
assert blocked_login.status_code == 403
assert "verify your email" in blocked_login.json()["detail"].lower()

verified = client.get(
    f"/auth/verify-email?token={captured['token']}",
    follow_redirects=False,
)
assert verified.status_code == 303
assert "verified=1" in verified.headers["location"]
expect(
    client.post(
        "/auth/login",
        json={"email": "verification@example.com", "password": "StrongPass8!"},
    ),
    200,
)

remembered_login = expect(
    client.post(
        "/auth/login",
        json={
            "email": "verification@example.com",
            "password": "StrongPass8!",
            "remember_me": True,
        },
    ),
    200,
).json()
assert remembered_login["expires_in"] == 30 * 24 * 60 * 60

# Verification links cannot be reused.
reused = client.get(
    f"/auth/verify-email?token={captured['token']}",
    follow_redirects=False,
)
assert reused.status_code == 303
assert "verification=invalid" in reused.headers["location"]


# Resend rotates the outstanding verification token and still goes through Brevo.
first_resend_token = {}


def capture_resend(to_email, username, token, expires_minutes):
    first_resend_token["token"] = token
    return True


auth_router.send_verification_email = capture_resend
expect(
    client.post(
        "/auth/register",
        json={
            "username": "resend-user",
            "email": "resend@example.com",
            "password": "StrongPass9!",
        },
    ),
    201,
)
original = first_resend_token["token"]
expect(client.post("/auth/resend-verification", json={"email": "resend@example.com"}), 200)
replacement = first_resend_token["token"]
assert replacement and replacement != original
old_link = client.get(f"/auth/verify-email?token={original}", follow_redirects=False)
assert "verification=invalid" in old_link.headers["location"]


# Third-party provider routes are deliberately absent; authentication is email-only.
assert client.get("/auth/oauth/config").status_code == 404
assert client.post(
    "/auth/oauth/login",
    json={"provider": "google", "credential": "disabled-provider-token"},
).status_code == 404

print("Email verification smoke test passed")
