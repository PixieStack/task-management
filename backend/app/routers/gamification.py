from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app import models
from app.schemas_extended import UserStatisticsOut, XPUpdate
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/gamification", tags=["gamification"])


@router.get("/stats", response_model=UserStatisticsOut)
def get_user_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user statistics and gamification data"""
    stats = db.query(models.UserStatistics).filter(
        models.UserStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        # Create initial stats
        stats = models.UserStatistics(
            user_id=current_user.id,
            level=1,
            total_xp=0,
            xp_to_next_level=2000,  # 2000 XP per level
            badges=[]
        )
        db.add(stats)
        db.commit()
        db.refresh(stats)
    
    return stats


@router.post("/xp")
def add_xp(xp_data: XPUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add XP to user (not too easy to earn - controlled by backend)"""
    stats = db.query(models.UserStatistics).filter(
        models.UserStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        stats = models.UserStatistics(
            user_id=current_user.id,
            level=1,
            total_xp=0,
            xp_to_next_level=2000,
            badges=[]
        )
        db.add(stats)
    
    # Validate XP amount (prevent cheating)
    if xp_data.amount > 500:  # Max 500 XP at once
        raise HTTPException(status_code=400, detail="XP amount too high")
    
    stats.total_xp += xp_data.amount
    
    # Level up logic (2000 XP per level)
    leveled_up = False
    while stats.total_xp >= stats.xp_to_next_level:
        stats.level += 1
        stats.xp_to_next_level = stats.level * 2000  # Each level requires 2000 more XP
        leveled_up = True
        
        # Award badge for level milestones
        if stats.level % 5 == 0:  # Every 5 levels
            badges = stats.badges or []
            badges.append({
                "id": f"level_{stats.level}",
                "name": f"Level {stats.level} Master",
                "description": f"Reached level {stats.level}",
                "icon": "🏆",
                "rarity": "epic" if stats.level >= 20 else "rare",
                "unlocked_date": datetime.utcnow().isoformat()
            })
            stats.badges = badges
    
    # Update rank based on level
    if stats.level >= 50:
        stats.rank = "Legend"
    elif stats.level >= 30:
        stats.rank = "Master"
    elif stats.level >= 20:
        stats.rank = "Expert"
    elif stats.level >= 10:
        stats.rank = "Advanced"
    elif stats.level >= 5:
        stats.rank = "Intermediate"
    else:
        stats.rank = "Beginner"
    
    stats.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(stats)
    
    return {
        "message": "XP added successfully",
        "leveled_up": leveled_up,
        "current_level": stats.level,
        "total_xp": stats.total_xp,
        "xp_to_next_level": stats.xp_to_next_level,
        "rank": stats.rank
    }


@router.get("/badges")
def get_badges(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's earned badges"""
    stats = db.query(models.UserStatistics).filter(
        models.UserStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        return {"badges": []}
    
    return {"badges": stats.badges or []}


@router.post("/badges/{badge_id}")
def award_badge(badge_id: str, badge_data: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Award a badge to user (backend controlled)"""
    stats = db.query(models.UserStatistics).filter(
        models.UserStatistics.user_id == current_user.id
    ).first()
    
    if not stats:
        raise HTTPException(status_code=404, detail="User stats not found")
    
    badges = stats.badges or []
    
    # Check if badge already awarded
    if any(b["id"] == badge_id for b in badges):
        raise HTTPException(status_code=400, detail="Badge already awarded")
    
    # Add new badge
    badge_data["id"] = badge_id
    badge_data["unlocked_date"] = datetime.utcnow().isoformat()
    badges.append(badge_data)
    stats.badges = badges
    stats.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(stats)
    
    return {"message": "Badge awarded!", "badge": badge_data}
