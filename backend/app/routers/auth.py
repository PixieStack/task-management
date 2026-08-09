import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import create_access_token, get_current_user, get_db
from app.auth_schemas import RegistrationResponse, VerificationRequest
from app.config import (
    APP_URL,
    EMAIL_VERIFICATION_EXPIRE_MINUTES,
    PASSWORD_RESET_EXPIRE_MINUTES,
)
from app.email_service import (
    send_account_deleted_email,
    send_email_changed_messages,
    send_password_changed_email,
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from app.schemas_extended import UserProfileOut, UserProfileUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_password(password: str) -> None:
    if not schemas.is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character",
        )


def _token_response(user: models.User) -> dict:
    token, expires_in = create_access_token(
        {"sub": user.email, "user_id": user.id, "auth_version": user.auth_version}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": user,
    }


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_verification_token(db: Session, user: models.User) -> str:
    now = datetime.utcnow()
    db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.user_id == user.id,
        models.EmailVerificationToken.used_at.is_(None),
    ).update({models.EmailVerificationToken.used_at: now}, synchronize_session=False)
    raw_token = secrets.token_urlsafe(48)
    db.add(
        models.EmailVerificationToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=now + timedelta(minutes=EMAIL_VERIFICATION_EXPIRE_MINUTES),
        )
    )
    return raw_token


@router.post("/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    _validate_password(user.password)
    username = user.username.strip()
    email = user.email.lower()
    if crud.get_user_by_username(db, username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if crud.get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        username=username,
        email=email,
        hashed_password=crud.get_password_hash(user.password),
        email_verified=False,
    )
    db.add(new_user)
    db.flush()
    raw_token = _create_verification_token(db, new_user)

    # Registration only succeeds when Brevo accepts the verification email.
    # This prevents a user from being told the account is ready when email delivery is unavailable.
    if not send_verification_email(
        new_user.email,
        new_user.username,
        raw_token,
        EMAIL_VERIFICATION_EXPIRE_MINUTES,
    ):
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="We could not send the verification email. Check the Brevo SMTP configuration and try again.",
        )

    db.commit()
    return {
        "message": "Account created. Check your email and verify it before signing in.",
        "email": new_user.email,
    }


@router.get("/verify-email")
def verify_email(token: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    record = db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.token_hash == _hash_token(token),
        models.EmailVerificationToken.used_at.is_(None),
        models.EmailVerificationToken.expires_at > now,
    ).first()
    if not record:
        return RedirectResponse(f"{APP_URL}/login?verification=invalid", status_code=303)

    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if not user or not user.is_active:
        return RedirectResponse(f"{APP_URL}/login?verification=invalid", status_code=303)

    user.email_verified = True
    user.email_verified_at = now
    record.used_at = now
    db.commit()
    background_tasks.add_task(send_welcome_email, user.email, user.username)
    return RedirectResponse(f"{APP_URL}/login?verified=1", status_code=303)


@router.post("/resend-verification")
def resend_verification(data: VerificationRequest, db: Session = Depends(get_db)):
    response = {"message": "If the account still needs verification, a new email has been sent."}
    user = crud.get_user_by_email(db, data.email.lower())
    if not user or not user.is_active or user.email_verified:
        return response

    raw_token = _create_verification_token(db, user)
    if not send_verification_email(user.email, user.username, raw_token, EMAIL_VERIFICATION_EXPIRE_MINUTES):
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="We could not send the verification email. Check the Brevo SMTP configuration and try again.",
        )
    db.commit()
    return response


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before signing in.")
    return _token_response(user)


@router.post("/forgot-password")
def forgot_password(data: schemas.ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    response = {"message": "If an account exists for that email, a password reset link has been sent."}
    user = crud.get_user_by_email(db, data.email.lower())
    if not user or not user.is_active:
        return response

    now = datetime.utcnow()
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({models.PasswordResetToken.used_at: now}, synchronize_session=False)
    raw_token = secrets.token_urlsafe(48)
    db.add(
        models.PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw_token),
            expires_at=now + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    db.commit()
    background_tasks.add_task(
        send_password_reset_email,
        user.email,
        user.username,
        raw_token,
        PASSWORD_RESET_EXPIRE_MINUTES,
    )
    return response


@router.post("/reset-password")
def reset_password(data: schemas.ResetPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    _validate_password(data.new_password)
    now = datetime.utcnow()
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_hash == _hash_token(data.token),
        models.PasswordResetToken.used_at.is_(None),
        models.PasswordResetToken.expires_at > now,
    ).first()
    if not reset_token:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")
    user = db.query(models.User).filter(models.User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")
    user.hashed_password = crud.get_password_hash(data.new_password)
    user.auth_version += 1
    reset_token.used_at = now
    db.commit()
    background_tasks.add_task(send_password_changed_email, user.email, user.username)
    return {"message": "Password reset successfully. You can now sign in with your new password."}


@router.post("/refresh", response_model=schemas.Token)
def refresh_token(current_user: models.User = Depends(get_current_user)):
    return _token_response(current_user)


@router.get("/me", response_model=schemas.UserOut)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_current_user(user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = user_update.model_dump(exclude_unset=True)
    if "username" in data and data["username"] != current_user.username and crud.get_user_by_username(db, data["username"]):
        raise HTTPException(status_code=400, detail="Username already taken")
    for key, value in data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(data: schemas.PasswordChange, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not crud.verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    _validate_password(data.new_password)
    current_user.hashed_password = crud.get_password_hash(data.new_password)
    current_user.auth_version += 1
    now = datetime.utcnow()
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == current_user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({models.PasswordResetToken.used_at: now}, synchronize_session=False)
    db.commit()
    background_tasks.add_task(send_password_changed_email, current_user.email, current_user.username)
    return {"message": "Password updated successfully"}


@router.post("/change-email", response_model=schemas.Token)
def change_email(data: schemas.EmailChange, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not crud.verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    new_email = data.new_email.lower()
    if new_email == current_user.email:
        raise HTTPException(status_code=400, detail="New email matches your current email")
    if crud.get_user_by_email(db, new_email):
        raise HTTPException(status_code=400, detail="Email already registered")
    old_email = current_user.email
    current_user.email = new_email
    current_user.auth_version += 1
    db.commit()
    db.refresh(current_user)
    background_tasks.add_task(send_email_changed_messages, old_email, new_email, current_user.username)
    return _token_response(current_user)


@router.post("/delete-account")
def delete_account(data: schemas.DeleteAccountRequest, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.confirm_phrase != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm account deletion')
    if not crud.verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    email, username, uid = current_user.email, current_user.username, current_user.id
    now = datetime.utcnow()
    current_user.is_active = False
    current_user.auth_version += 1
    current_user.deleted_at = now
    for model, owner_column in (
        (models.TimeSession, models.TimeSession.user_id),
        (models.DailyTodo, models.DailyTodo.user_id),
        (models.HabitEntry, models.HabitEntry.user_id),
        (models.Habit, models.Habit.user_id),
        (models.Challenge, models.Challenge.user_id),
        (models.Project, models.Project.user_id),
    ):
        db.query(model).filter(owner_column == uid, model.deleted_at.is_(None)).update(
            {model.deleted_at: now}, synchronize_session=False
        )
    db.query(models.Task).filter(
        models.Task.owner_id == uid,
        models.Task.deleted_at.is_(None),
    ).update({models.Task.deleted_at: now}, synchronize_session=False)
    db.commit()
    background_tasks.add_task(send_account_deleted_email, email, username)
    return {"message": "Account deleted successfully"}


@router.post("/logout")
def logout(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.auth_version += 1
    db.commit()
    return {"message": "Successfully logged out"}


@router.post("/verify-token")
def verify_token(current_user: models.User = Depends(get_current_user)):
    return {"valid": True, "user": schemas.UserOut.model_validate(current_user)}


@router.get("/profile", response_model=UserProfileOut)
def get_profile(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/profile", response_model=UserProfileOut)
def update_profile(data: UserProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id, **data.model_dump(exclude_unset=True))
        db.add(profile)
    else:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/update-user", response_model=schemas.UserOut)
def update_user_info(user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return update_current_user(user_update, current_user, db)
