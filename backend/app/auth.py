import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app import models, database

# Load environment variables from .env file 
load_dotenv(dotenv_path="C:/Users/thwal/Desktop/Portfolio/task-management/backend/app/.env")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Retrieve and print SECRET_KEY for debugging
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# Debugging output
print(f"Loaded SECRET_KEY: {SECRET_KEY}")

if not SECRET_KEY or not isinstance(SECRET_KEY, str):
    raise ValueError("SECRET_KEY is not set, is empty, or not a string.")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode JWT token with current SECRET_KEY and ALGORITHM
        print(f"Decoding token with SECRET_KEY: {SECRET_KEY}")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        print("JWT decoding failed")
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user