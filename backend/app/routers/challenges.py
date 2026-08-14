from datetime import datetime
from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models
from app.archive_logic import archive_completed_items, set_completion_state
from app.auth import get_current_user, get_db
from app.email_service import send_challenge_completion_email
from app.schemas_extended import ChallengeCreate, ChallengeOut, ChallengeUpdate

router = APIRouter(prefix="/api/challenges", tags=["challenges"])
META = {"reading": {"icon": "fas fa-book-open", "title": "Reading Challenge"}}

def _get(cid: int, uid: int, db: Session):
    obj = db.query(models.Challenge).filter(
        models.Challenge.id == cid,
        models.Challenge.user_id == uid,
        models.Challenge.deleted_at.is_(None),
    ).first()
    if not obj: raise HTTPException(status_code=404, detail="Challenge not found")
    return obj

@router.post("", response_model=ChallengeOut, status_code=status.HTTP_201_CREATED)
def create_challenge(data: ChallengeCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    meta = META[data.challenge_type]
    obj = models.Challenge(user_id=current_user.id, title=data.title, description=data.description, duration=data.duration, challenge_type=data.challenge_type, book_type=data.book_type, start_date=datetime.utcnow(), xp_reward=0, icon=data.icon or meta["icon"])
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("", response_model=List[ChallengeOut])
def get_challenges(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    archive_completed_items(db, current_user.id)
    return db.query(models.Challenge).filter(
        models.Challenge.user_id == current_user.id,
        models.Challenge.challenge_type == "reading",
        models.Challenge.deleted_at.is_(None),
    ).order_by(models.Challenge.created_at.desc()).all()

@router.get("/{challenge_id}", response_model=ChallengeOut)
def get_challenge(challenge_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)): return _get(challenge_id, current_user.id, db)

@router.put("/{challenge_id}", response_model=ChallengeOut)
def update_challenge(challenge_id: int, data: ChallengeUpdate, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(challenge_id, current_user.id, db)
    was_completed = obj.completed
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    obj.progress = min(100.0, (obj.current_streak / obj.duration) * 100); obj.completed = obj.current_streak >= obj.duration
    if obj.completed: obj.is_active = False
    set_completion_state(obj, obj.completed)
    obj.updated_at = datetime.utcnow(); db.commit(); db.refresh(obj)
    if obj.completed and not was_completed:
        background_tasks.add_task(send_challenge_completion_email, current_user.email, current_user.username, obj.title, obj.duration)
    return obj

@router.post("/check-in/{challenge_id}", response_model=ChallengeOut)
def check_in_challenge(challenge_id: int, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    obj = _get(challenge_id, current_user.id, db)
    if obj.completed or not obj.is_active: raise HTTPException(status_code=400, detail="This challenge is already completed")
    now = datetime.utcnow()
    if obj.last_check_in and obj.last_check_in.date() == now.date(): raise HTTPException(status_code=400, detail="You have already checked in today")
    obj.current_streak += 1; obj.best_streak = max(obj.best_streak, obj.current_streak); obj.last_check_in = now; obj.progress = min(100.0, (obj.current_streak / obj.duration) * 100)
    if obj.current_streak >= obj.duration: obj.completed = True; obj.is_active = False
    set_completion_state(obj, obj.completed, now)
    obj.updated_at = now; db.commit(); db.refresh(obj)
    if obj.completed:
        background_tasks.add_task(send_challenge_completion_email, current_user.email, current_user.username, obj.title, obj.duration)
    return obj

@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_challenge(challenge_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    challenge = _get(challenge_id, current_user.id, db)
    challenge.deleted_at = datetime.utcnow()
    challenge.updated_at = challenge.deleted_at
    db.commit(); return None
