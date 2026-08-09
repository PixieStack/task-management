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


# Google provider tokens are verified by the backend adapter, then stored as app identities.
def fake_google(provider, credential):
    assert provider == "google"
    assert credential == "google-test-credential-token"
    return {
        "iss": "https://accounts.google.com",
        "sub": "google-subject-123",
        "email": "google-user@example.com",
        "email_verified": True,
        "given_name": "Google",
        "family_name": "Tester",
    }


auth_router.verify_provider_id_token = fake_google
google_login = expect(
    client.post(
        "/auth/oauth/login",
        json={"provider": "google", "credential": "google-test-credential-token"},
    ),
    200,
).json()
assert google_login["user"]["email"] == "google-user@example.com"
with database.SessionLocal() as db:
    google_identity = db.query(models.OAuthIdentity).filter(
        models.OAuthIdentity.provider == "google",
        models.OAuthIdentity.provider_subject == "google-subject-123",
    ).first()
    assert google_identity is not None
    google_user = db.query(models.User).filter(models.User.id == google_identity.user_id).first()
    assert google_user is not None and google_user.email_verified is True


# Apple uses the same app account/session model after its provider token is verified.
def fake_apple(provider, credential):
    assert provider == "apple"
    assert credential == "apple-test-credential-token"
    return {
        "iss": "https://appleid.apple.com",
        "sub": "apple-subject-456",
        "email": "apple-user@example.com",
        "email_verified": "true",
    }


auth_router.verify_provider_id_token = fake_apple
apple_login = expect(
    client.post(
        "/auth/oauth/login",
        json={"provider": "apple", "credential": "apple-test-credential-token"},
    ),
    200,
).json()
assert apple_login["user"]["email"] == "apple-user@example.com"
with database.SessionLocal() as db:
    apple_identity = db.query(models.OAuthIdentity).filter(
        models.OAuthIdentity.provider == "apple",
        models.OAuthIdentity.provider_subject == "apple-subject-456",
    ).first()
    assert apple_identity is not None


# Existing email accounts can safely link a verified provider identity instead of duplicating users.
with database.SessionLocal() as db:
    before = db.query(models.User).filter(models.User.email == "verification@example.com").count()


def fake_linked_google(_provider, _credential):
    return {
        "iss": "https://accounts.google.com",
        "sub": "google-link-existing",
        "email": "verification@example.com",
        "email_verified": True,
    }


auth_router.verify_provider_id_token = fake_linked_google
expect(
    client.post(
        "/auth/oauth/login",
        json={"provider": "google", "credential": "link-existing-account-token"},
    ),
    200,
)
with database.SessionLocal() as db:
    after = db.query(models.User).filter(models.User.email == "verification@example.com").count()
    assert before == after == 1
    assert db.query(models.OAuthIdentity).filter(
        models.OAuthIdentity.provider == "google",
        models.OAuthIdentity.provider_subject == "google-link-existing",
    ).first() is not None

print("Email verification and OAuth smoke test passed")
