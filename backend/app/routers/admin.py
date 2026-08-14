import json
from datetime import datetime
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, get_db
from app.config import (
    ADMIN_EMAIL,
    APPLE_CLIENT_ID,
    BREVO_SMTP_KEY,
    BREVO_SMTP_LOGIN,
    BREVO_SMTP_SERVER,
    GOOGLE_CLIENT_ID,
    GROQ_API_KEY,
    SENDER_EMAIL,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _is_env_admin(user: models.User) -> bool:
    return bool(ADMIN_EMAIL and user.email.lower() == ADMIN_EMAIL.lower())


def get_current_admin(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    try:
        is_admin = bool(
            db.execute(
                text("select is_admin from users where id = :user_id"),
                {"user_id": current_user.id},
            ).scalar()
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin schema is not available. Apply the admin control center migration.",
        ) from exc

    # ADMIN_EMAIL is the secure bootstrap path for the first administrator.
    # Once that verified account signs in, persist the role in the application DB.
    if _is_env_admin(current_user) and not is_admin:
        db.execute(
            text("update users set is_admin = :value where id = :user_id"),
            {"value": True, "user_id": current_user.id},
        )
        db.commit()
        is_admin = True

    if not is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return current_user


def _audit(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> None:
    payload = json.dumps(details or {})
    if db.bind and db.bind.dialect.name == "postgresql":
        statement = text(
            """
            insert into admin_audit_logs
                (admin_user_id, action, target_type, target_id, details, created_at)
            values
                (:admin_user_id, :action, :target_type, :target_id, cast(:details as jsonb), :created_at)
            """
        )
    else:
        statement = text(
            """
            insert into admin_audit_logs
                (admin_user_id, action, target_type, target_id, details, created_at)
            values
                (:admin_user_id, :action, :target_type, :target_id, :details, :created_at)
            """
        )
    db.execute(
        statement,
        {
            "admin_user_id": admin_user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": payload,
            "created_at": datetime.utcnow(),
        },
    )


@router.get("/session")
def admin_session(admin: models.User = Depends(get_current_admin)):
    return {
        "is_admin": True,
        "user": {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
        },
    }


@router.get("/overview")
def overview(
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    deleted_count = db.execute(text("select count(*) from deleted_accounts")).scalar() or 0
    oauth_counts = {
        row.provider: row.count
        for row in db.execute(
            text("select provider, count(*) as count from oauth_identities group by provider")
        ).mappings()
    }
    return {
        "accounts": {
            "total": db.query(func.count(models.User.id)).scalar() or 0,
            "active": db.query(func.count(models.User.id)).filter(models.User.is_active.is_(True)).scalar() or 0,
            "inactive": db.query(func.count(models.User.id)).filter(models.User.is_active.is_(False)).scalar() or 0,
            "verified": db.query(func.count(models.User.id)).filter(models.User.email_verified.is_(True)).scalar() or 0,
            "unverified": db.query(func.count(models.User.id)).filter(models.User.email_verified.is_(False)).scalar() or 0,
            "deleted": deleted_count,
            "google": oauth_counts.get("google", 0),
            "apple": oauth_counts.get("apple", 0),
        },
        "productivity": {
            "tasks": db.query(func.count(models.Task.id)).scalar() or 0,
            "todos": db.query(func.count(models.DailyTodo.id)).scalar() or 0,
            "habits": db.query(func.count(models.Habit.id)).scalar() or 0,
            "challenges": db.query(func.count(models.Challenge.id)).scalar() or 0,
            "active_timers": db.query(func.count(models.TimeSession.id)).filter(models.TimeSession.ended_at.is_(None)).scalar() or 0,
            "ai_requests_today": db.query(func.count(models.AIConversation.id)).filter(models.AIConversation.created_at >= today).scalar() or 0,
        },
    }


@router.get("/accounts")
def accounts(
    account_status: str = Query("all", alias="status"),
    limit: int = Query(100, ge=1, le=500),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    where = ""
    params: dict = {"limit": limit}
    if account_status == "active":
        where = "where u.is_active = :active"
        params["active"] = True
    elif account_status == "inactive":
        where = "where u.is_active = :active"
        params["active"] = False
    elif account_status == "unverified":
        where = "where u.email_verified = :verified"
        params["verified"] = False
    elif account_status == "admins":
        where = "where u.is_admin = :admin"
        params["admin"] = True
    elif account_status != "all":
        raise HTTPException(status_code=400, detail="Unknown account status filter")

    rows = db.execute(
        text(
            f"""
            select
              u.id,
              u.username,
              u.email,
              u.is_active,
              u.email_verified,
              u.is_admin,
              u.created_at,
              u.last_login_at,
              u.last_active_at,
              (select count(*) from tasks t where t.owner_id = u.id) as tasks_count,
              (select count(*) from daily_todos d where d.user_id = u.id) as todos_count,
              (select count(*) from habits h where h.user_id = u.id) as habits_count,
              (select count(*) from challenges c where c.user_id = u.id) as challenges_count,
              (select count(*) from oauth_identities oi where oi.user_id = u.id and oi.provider = 'google') as google_linked,
              (select count(*) from oauth_identities oi where oi.user_id = u.id and oi.provider = 'apple') as apple_linked
            from users u
            {where}
            order by u.created_at desc
            limit :limit
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/deleted-accounts")
def deleted_accounts(
    limit: int = Query(100, ge=1, le=500),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    rows = db.execute(
        text(
            """
            select id, original_user_id, username, email, account_created_at, deleted_at, deletion_reason
            from deleted_accounts
            order by deleted_at desc
            limit :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.get("/health")
def health(
    request: Request,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    started = perf_counter()
    database_ok = True
    database_error = None
    try:
        db.execute(text("select 1")).scalar()
    except Exception as exc:  # pragma: no cover - defensive production reporting
        database_ok = False
        database_error = str(exc)
    db_latency = round((perf_counter() - started) * 1000, 2)

    started_at = getattr(request.app.state, "started_at", datetime.utcnow())
    return {
        "backend": {"status": "operational", "version": request.app.version},
        "database": {
            "status": "operational" if database_ok else "degraded",
            "latency_ms": db_latency,
            "error": database_error,
        },
        "ai": {"status": "configured" if GROQ_API_KEY else "not_configured"},
        "email": {
            "status": "configured"
            if all([BREVO_SMTP_SERVER, BREVO_SMTP_LOGIN, BREVO_SMTP_KEY, SENDER_EMAIL])
            else "not_configured"
        },
        "google_sign_in": {"status": "configured" if GOOGLE_CLIENT_ID else "not_configured"},
        "apple_sign_in": {"status": "configured" if APPLE_CLIENT_ID else "not_configured"},
        "uptime_seconds": max(0, int((datetime.utcnow() - started_at).total_seconds())),
    }


@router.get("/api-metrics")
def api_metrics(
    request: Request,
    admin: models.User = Depends(get_current_admin),
):
    del admin
    metrics = getattr(request.app.state, "api_metrics", {})
    result = []
    for key, value in metrics.items():
        count = value.get("count", 0)
        result.append(
            {
                "endpoint": key,
                "requests": count,
                "errors": value.get("errors", 0),
                "average_ms": round(value.get("total_ms", 0.0) / count, 2) if count else 0,
                "last_status": value.get("last_status"),
                "last_seen": value.get("last_seen"),
            }
        )
    return sorted(result, key=lambda item: item["requests"], reverse=True)


@router.get("/ai-activity")
def ai_activity(
    limit: int = Query(50, ge=1, le=200),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    rows = (
        db.query(models.AIConversation, models.User)
        .join(models.User, models.User.id == models.AIConversation.user_id)
        .order_by(models.AIConversation.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": conversation.id,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "question": conversation.question,
            "answer": conversation.answer,
            "executed_actions": (conversation.context or {}).get("executed_actions", [])
            if isinstance(conversation.context, dict)
            else [],
            "created_at": conversation.created_at,
        }
        for conversation, user in rows
    ]


@router.get("/audit-logs")
def audit_logs(
    limit: int = Query(100, ge=1, le=500),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    del admin
    rows = db.execute(
        text(
            """
            select l.id, l.admin_user_id, u.username as admin_username, l.action,
                   l.target_type, l.target_id, l.details, l.created_at
            from admin_audit_logs l
            left join users u on u.id = l.admin_user_id
            order by l.created_at desc
            limit :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()
    return [dict(row) for row in rows]


@router.post("/accounts/{user_id}/suspend")
def suspend_account(
    user_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own administrator account")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Account not found")
    target.is_active = False
    target.auth_version += 1
    _audit(db, admin.id, "account.suspend", "user", str(target.id), {"email": target.email})
    db.commit()
    return {"message": "Account suspended"}


@router.post("/accounts/{user_id}/reactivate")
def reactivate_account(
    user_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Account not found")
    target.is_active = True
    _audit(db, admin.id, "account.reactivate", "user", str(target.id), {"email": target.email})
    db.commit()
    return {"message": "Account reactivated"}


@router.post("/accounts/{user_id}/force-logout")
def force_logout(
    user_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Account not found")
    target.auth_version += 1
    _audit(db, admin.id, "account.force_logout", "user", str(target.id), {"email": target.email})
    db.commit()
    return {"message": "All existing sessions for this account were invalidated"}
