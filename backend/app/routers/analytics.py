from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app import models, crud
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/")
def get_analytics(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    return crud.get_task_analytics(db, current_user.id)