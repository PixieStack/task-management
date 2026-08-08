from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.auth import create_access_token, get_current_user, get_db
from app.email_service import send_account_deleted_email, send_email_changed_messages, send_password_changed_email, send_welcome_email
from app.schemas_extended import UserProfileOut, UserProfileUpdate

router = APIRouter(prefix="/auth", tags=["auth"])

def _validate_password(password: str) -> None:
    if not schemas.is_strong_password(password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character")

def _token_response(user: models.User) -> dict:
    token, expires_in = create_access_token({"sub": user.email, "user_id": user.id})
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in, "user": user}

@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    _validate_password(user.password)
    if crud.get_user_by_username(db, user.username.strip()): raise HTTPException(status_code=400, detail="Username already registered")
    if crud.get_user_by_email(db, user.email.lower()): raise HTTPException(status_code=400, detail="Email already registered")
    new_user = crud.create_user(db, user)
    background_tasks.add_task(send_welcome_email, new_user.email, new_user.username)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, data.email, data.password)
    if not user: raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active: raise HTTPException(status_code=403, detail="Account is deactivated")
    return _token_response(user)

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(current_user: models.User = Depends(get_current_user)): return _token_response(current_user)

@router.get("/me", response_model=schemas.UserOut)
def get_current_user_info(current_user: models.User = Depends(get_current_user)): return current_user

@router.put("/me", response_model=schemas.UserOut)
def update_current_user(user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = user_update.model_dump(exclude_unset=True)
    if "username" in data and data["username"] != current_user.username and crud.get_user_by_username(db, data["username"]):
        raise HTTPException(status_code=400, detail="Username already taken")
    for key, value in data.items(): setattr(current_user, key, value)
    db.commit(); db.refresh(current_user); return current_user

@router.post("/change-password")
def change_password(data: schemas.PasswordChange, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not crud.verify_password(data.current_password, current_user.hashed_password): raise HTTPException(status_code=400, detail="Current password is incorrect")
    _validate_password(data.new_password)
    current_user.hashed_password = crud.get_password_hash(data.new_password); db.commit()
    background_tasks.add_task(send_password_changed_email, current_user.email, current_user.username)
    return {"message": "Password updated successfully"}

@router.post("/change-email", response_model=schemas.Token)
def change_email(data: schemas.EmailChange, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not crud.verify_password(data.password, current_user.hashed_password): raise HTTPException(status_code=400, detail="Password is incorrect")
    new_email = data.new_email.lower()
    if new_email == current_user.email: raise HTTPException(status_code=400, detail="New email matches your current email")
    if crud.get_user_by_email(db, new_email): raise HTTPException(status_code=400, detail="Email already registered")
    old_email = current_user.email; current_user.email = new_email; db.commit(); db.refresh(current_user)
    background_tasks.add_task(send_email_changed_messages, old_email, new_email, current_user.username)
    return _token_response(current_user)

@router.post("/delete-account")
def delete_account(data: schemas.DeleteAccountRequest, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.confirm_phrase != "DELETE": raise HTTPException(status_code=400, detail='Type "DELETE" to confirm account deletion')
    if not crud.verify_password(data.password, current_user.hashed_password): raise HTTPException(status_code=400, detail="Password is incorrect")
    email, username, uid = current_user.email, current_user.username, current_user.id
    db.query(models.HabitEntry).filter(models.HabitEntry.user_id == uid).delete(synchronize_session=False)
    db.query(models.Habit).filter(models.Habit.user_id == uid).delete(synchronize_session=False)
    db.query(models.Challenge).filter(models.Challenge.user_id == uid).delete(synchronize_session=False)
    db.query(models.AIConversation).filter(models.AIConversation.user_id == uid).delete(synchronize_session=False)
    db.query(models.UserProfile).filter(models.UserProfile.user_id == uid).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.owner_id == uid).delete(synchronize_session=False)
    db.delete(current_user); db.commit(); background_tasks.add_task(send_account_deleted_email, email, username)
    return {"message": "Account deleted successfully"}

@router.post("/logout")
def logout(): return {"message": "Successfully logged out"}

@router.post("/verify-token")
def verify_token(current_user: models.User = Depends(get_current_user)): return {"valid": True, "user": schemas.UserOut.model_validate(current_user)}

@router.get("/profile", response_model=UserProfileOut)
def get_profile(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id); db.add(profile); db.commit(); db.refresh(profile)
    return profile

@router.put("/profile", response_model=UserProfileOut)
def update_profile(data: UserProfileUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id, **data.model_dump(exclude_unset=True)); db.add(profile)
    else:
        for key, value in data.model_dump(exclude_unset=True).items(): setattr(profile, key, value)
        profile.updated_at = datetime.utcnow()
    db.commit(); db.refresh(profile); return profile

@router.put("/update-user", response_model=schemas.UserOut)
def update_user_info(user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return update_current_user(user_update, current_user, db)
