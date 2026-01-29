from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from app import models
from app.schemas_extended import ChallengeCreate, ChallengeUpdate, ChallengeOut, ChallengeCheckIn
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.post("/", response_model=ChallengeOut, status_code=status.HTTP_201_CREATED)
def create_challenge(challenge: ChallengeCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new challenge"""
    db_challenge = models.Challenge(
        user_id=current_user.id,
        title=challenge.title,
        description=challenge.description,
        duration=challenge.duration,
        challenge_type=challenge.challenge_type,
        start_date=datetime.utcnow(),
        xp_reward=challenge.xp_reward or 100,
        icon=challenge.icon or "fas fa-trophy"
    )
    db.add(db_challenge)
    db.commit()
    db.refresh(db_challenge)
    return db_challenge


@router.get("/", response_model=List[ChallengeOut])
def get_challenges(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all challenges for current user"""
    challenges = db.query(models.Challenge).filter(
        models.Challenge.user_id == current_user.id,
        models.Challenge.is_active == True
    ).all()
    return challenges


@router.get("/{challenge_id}", response_model=ChallengeOut)
def get_challenge(challenge_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get specific challenge"""
    challenge = db.query(models.Challenge).filter(
        models.Challenge.id == challenge_id,
        models.Challenge.user_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge


@router.put("/{challenge_id}", response_model=ChallengeOut)
def update_challenge(challenge_id: int, challenge_update: ChallengeUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update challenge"""
    challenge = db.query(models.Challenge).filter(
        models.Challenge.id == challenge_id,
        models.Challenge.user_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    update_data = challenge_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(challenge, key, value)
    
    challenge.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(challenge)
    return challenge


@router.post("/check-in/{challenge_id}", response_model=ChallengeOut)
def check_in_challenge(challenge_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check in to a challenge (24-hour cooldown)"""
    challenge = db.query(models.Challenge).filter(
        models.Challenge.id == challenge_id,
        models.Challenge.user_id == current_user.id
    ).first()
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Check 24-hour restriction
    if challenge.last_check_in:
        time_since_last_checkin = datetime.utcnow() - challenge.last_check_in
        if time_since_last_checkin < timedelta(hours=24):
            hours_remaining = 24 - (time_since_last_checkin.total_seconds() / 3600)
            raise HTTPException(
                status_code=400,
                detail=f"Cannot check in yet. Please wait {hours_remaining:.1f} more hours."
            )
    
    # Update challenge
    challenge.current_streak += 1
    challenge.last_check_in = datetime.utcnow()
    
    if challenge.current_streak > challenge.best_streak:
        challenge.best_streak = challenge.current_streak
    
    # Update progress
    challenge.progress = (challenge.current_streak / challenge.duration) * 100
    
    # Check if completed
    if challenge.current_streak >= challenge.duration:
        challenge.completed = True
        challenge.is_active = False
        
        # Award XP
        stats = db.query(models.UserStatistics).filter(
            models.UserStatistics.user_id == current_user.id
        ).first()
        if stats:
            stats.total_xp += challenge.xp_reward
            stats.challenges_completed += 1
            # Level up logic (2000 XP per level)
            while stats.total_xp >= stats.xp_to_next_level:
                stats.level += 1
                stats.xp_to_next_level = stats.level * 2000
    
    challenge.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(challenge)
    return challenge


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_challenge(challenge_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete challenge"""
    challenge = db.query(models.Challenge).filter(
        models.Challenge.id == challenge_id,
        models.Challenge.user_id == current_user.id
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    db.delete(challenge)
    db.commit()
    return
