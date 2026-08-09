import os

os.environ["ADMIN_EMAIL"] = "owner@example.com"
os.environ["BREVO_SMTP_LOGIN"] = ""
os.environ["BREVO_SMTP_KEY"] = ""
os.environ["SENDER_EMAIL"] = ""
os.environ["GROQ_API_KEY"] = ""

from fastapi.testclient import TestClient
from sqlalchemy import text

from app import crud, database, models
from app.main import app


models.Base.metadata.drop_all(bind=database.engine)
models.Base.metadata.create_all(bind=database.engine)

with database.engine.begin() as connection:
    # Production receives these through the Supabase migration. The isolated
    # SQLite smoke DB mirrors only the admin schema needed by this test.
    connection.execute(text("alter table users add column is_admin boolean not null default 0"))
    connection.execute(text("alter table users add column last_login_at datetime"))
    connection.execute(text("alter table users add column last_active_at datetime"))
    connection.execute(text("""
        create table deleted_accounts (
          id integer primary key autoincrement,
          original_user_id integer,
          username text not null,
          email text not null,
          account_created_at datetime,
          deleted_at datetime not null,
          deletion_reason text not null
        )
    """))
    connection.execute(text("""
        create table admin_audit_logs (
          id integer primary key autoincrement,
          admin_user_id integer,
          action text not null,
          target_type text,
          target_id text,
          details text not null default '{}',
          created_at datetime not null
        )
    """))

session = database.SessionLocal()
try:
    owner = models.User(
        username="owner",
        email="owner@example.com",
        hashed_password=crud.get_password_hash("OwnerPass1!"),
        email_verified=True,
        is_active=True,
    )
    member = models.User(
        username="member",
        email="member@example.com",
        hashed_password=crud.get_password_hash("MemberPass1!"),
        email_verified=True,
        is_active=True,
    )
    session.add_all([owner, member])
    session.commit()
finally:
    session.close()

client = TestClient(app)


def login(email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


owner_headers = login("owner@example.com", "OwnerPass1!")
member_headers = login("member@example.com", "MemberPass1!")

# A normal authenticated account cannot enter the private operations API.
denied = client.get("/api/admin/session", headers=member_headers)
assert denied.status_code == 403, denied.text

# ADMIN_EMAIL bootstraps the first verified administrator and persists is_admin.
admin_session = client.get("/api/admin/session", headers=owner_headers)
assert admin_session.status_code == 200, admin_session.text
assert admin_session.json()["is_admin"] is True

with database.engine.connect() as connection:
    persisted = connection.execute(
        text("select is_admin from users where email = :email"),
        {"email": "owner@example.com"},
    ).scalar()
    assert bool(persisted) is True

for path in [
    "/api/admin/overview",
    "/api/admin/accounts",
    "/api/admin/health",
    "/api/admin/api-metrics",
    "/api/admin/ai-activity",
    "/api/admin/audit-logs",
    "/api/admin/deleted-accounts",
]:
    response = client.get(path, headers=owner_headers)
    assert response.status_code == 200, f"{path}: {response.status_code} {response.text}"

accounts = client.get("/api/admin/accounts", headers=owner_headers).json()
member = next(account for account in accounts if account["email"] == "member@example.com")
member_id = member["id"]

suspend = client.post(f"/api/admin/accounts/{member_id}/suspend", headers=owner_headers)
assert suspend.status_code == 200, suspend.text
assert client.get("/auth/me", headers=member_headers).status_code == 401

reactivate = client.post(f"/api/admin/accounts/{member_id}/reactivate", headers=owner_headers)
assert reactivate.status_code == 200, reactivate.text
new_member_headers = login("member@example.com", "MemberPass1!")

force = client.post(f"/api/admin/accounts/{member_id}/force-logout", headers=owner_headers)
assert force.status_code == 200, force.text
assert client.get("/auth/me", headers=new_member_headers).status_code == 401

logs = client.get("/api/admin/audit-logs", headers=owner_headers).json()
actions = {entry["action"] for entry in logs}
assert {"account.suspend", "account.reactivate", "account.force_logout"}.issubset(actions)

print("Admin control center smoke test passed")
