from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
from app import schemas, crud, models
from app.schemas_extended import UserProfileCreate, UserProfileUpdate, UserProfileOut, UserUpdateExtended
from app.auth import SECRET_KEY, ALGORITHM, get_db, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if username already exists
        db_user = crud.get_user_by_username(db, user.username)
        if db_user:
            raise HTTPException(
                status_code=400, 
                detail="Username already registered"
            )
        
        # Check if email already exists
        db_user = crud.get_user_by_email(db, user.email)
        if db_user:
            raise HTTPException(
                status_code=400, 
                detail="Email already registered"
            )
        
        if len(user.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long"
            )
        
        # Create the user
        new_user = crud.create_user(db, user)
        return new_user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating user: {str(e)}"
        )

@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login and get access token"""
    try:
        # Authenticate user
        user = crud.authenticate_user(db, login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=401, 
                detail="Invalid email or password"
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=403,  
                detail="Account is deactivated"
            )
        
        # Create access token with expiration
        access_token_expires = timedelta(hours=24)
        expire = datetime.utcnow() + access_token_expires
        
        token_data = {
            "sub": user.email,
            "exp": expire,
            "user_id": user.id,  
            "iat": datetime.utcnow() 
        }
        
        access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        
        # Return token and user information
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "expires_in": int(access_token_expires.total_seconds()), 
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "created_at": user.created_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during login: {str(e)}"
        )

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(current_user: schemas.UserOut = Depends(get_current_user), db: Session = Depends(get_db)):
    """Refresh access token"""
    try:
        # Check if user is still active
        user = crud.get_user_by_email(db, current_user.email)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account is deactivated"
            )
        
        # Create new access token
        access_token_expires = timedelta(hours=24)
        expire = datetime.utcnow() + access_token_expires
        
        token_data = {
            "sub": user.email,
            "exp": expire,
            "user_id": user.id,
            "iat": datetime.utcnow()
        }
        
        access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": int(access_token_expires.total_seconds()),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "created_at": user.created_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error refreshing token: {str(e)}"
        )

@router.get("/me", response_model=schemas.UserOut)
def get_current_user_info(current_user: schemas.UserOut = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@router.put("/me", response_model=schemas.UserOut)
def update_current_user(
    user_update: schemas.UserUpdate, 
    current_user: schemas.UserOut = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""
    try:
        if user_update.username and user_update.username != current_user.username:
            existing_user = crud.get_user_by_username(db, user_update.username)
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Username already taken"
                )
        
        if user_update.email and user_update.email != current_user.email:
            existing_user = crud.get_user_by_email(db, user_update.email)
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered"
                )
        
        # Update user
        updated_user = crud.update_user(db, current_user.id, user_update)
        if not updated_user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        return updated_user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating user: {str(e)}"
        )

@router.post("/change-password")
def change_password(
    password_data: schemas.PasswordChange,
    current_user: schemas.UserOut = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    try:
        # Verify current password
        user = crud.authenticate_user(db, current_user.email, password_data.current_password)
        if not user:
            raise HTTPException(
                status_code=400,
                detail="Current password is incorrect"
            )
        
        # Validate new password
        if len(password_data.new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="New password must be at least 6 characters long"
            )
        
        # Update password
        success = crud.update_user_password(db, current_user.id, password_data.new_password)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update password"
            )
        
        return {"message": "Password updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error changing password: {str(e)}"
        )

@router.post("/logout")
def logout():
    """Logout user (client should delete token)"""
    return {"message": "Successfully logged out"}

@router.post("/verify-token")
def verify_token(current_user: schemas.UserOut = Depends(get_current_user)):
    """Verify if token is valid"""


# Profile Management Endpoints

@router.get("/profile", response_model=UserProfileOut)
def get_profile(current_user: schemas.UserOut = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user profile"""
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        # Create empty profile
        profile = models.UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/profile", response_model=UserProfileOut)
def update_profile(profile_update: UserProfileUpdate, current_user: schemas.UserOut = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user profile"""
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    
    if not profile:
        # Create new profile
        profile_data = profile_update.dict(exclude_unset=True)
        profile = models.UserProfile(user_id=current_user.id, **profile_data)
        db.add(profile)
    else:
        # Update existing profile
        update_data = profile_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(profile, key, value)
        profile.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(profile)
    return profile

@router.put("/update-user", response_model=schemas.UserOut)
def update_user_info(user_update: UserUpdateExtended, current_user: schemas.UserOut = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user basic info (username, email, first_name, last_name)"""
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    
    # Check uniqueness for username and email
    if "username" in update_data and update_data["username"] != user.username:
        existing = db.query(models.User).filter(models.User.username == update_data["username"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    if "email" in update_data and update_data["email"] != user.email:
        existing = db.query(models.User).filter(models.User.email == update_data["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user

    return {"valid": True, "user": current_user}