from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from app.database import SessionLocal

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is required. Set it in backend/.env or the deployment environment.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(data: dict, expires_minutes: int | None = None) -> tuple[str, int]:
    minutes = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    expires_delta = timedelta(minutes=minutes)
    expire = datetime.utcnow() + expires_delta

    payload = data.copy()
    payload.update({"exp": expire, "iat": datetime.utcnow()})
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, int(expires_delta.total_seconds())


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        auth_version = payload.get("auth_version")
        if not email or auth_version is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active or user.auth_version != auth_version:
        raise credentials_exception
    return user
