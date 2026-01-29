from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from app import models
from app.schemas_extended import RoadmapCreate, RoadmapUpdate, RoadmapOut
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/roadmaps", tags=["roadmaps"])


@router.post("/", response_model=RoadmapOut, status_code=status.HTTP_201_CREATED)
def create_roadmap(roadmap: RoadmapCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new 12-month roadmap (max 3 per year)"""
    # Check if user already has 3 roadmaps for this year
    year = roadmap.year
    existing_roadmaps = db.query(models.Roadmap).filter(
        models.Roadmap.user_id == current_user.id,
        models.Roadmap.year == year,
        models.Roadmap.is_archived == False
    ).count()
    
    if existing_roadmaps >= 3:
        raise HTTPException(
            status_code=400,
            detail="You can only have 3 active roadmaps per year. Please archive an existing one first."
        )
    
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)
    
    db_roadmap = models.Roadmap(
        user_id=current_user.id,
        title=roadmap.title,
        description=roadmap.description,
        year=year,
        start_date=start_date,
        end_date=end_date
    )
    db.add(db_roadmap)
    db.commit()
    db.refresh(db_roadmap)
    return db_roadmap


@router.get("/", response_model=List[RoadmapOut])
def get_roadmaps(include_archived: bool = False, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all roadmaps for current user"""
    query = db.query(models.Roadmap).filter(models.Roadmap.user_id == current_user.id)
    
    if not include_archived:
        query = query.filter(models.Roadmap.is_archived == False)
    
    roadmaps = query.all()
    return roadmaps


@router.get("/{roadmap_id}", response_model=RoadmapOut)
def get_roadmap(roadmap_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get specific roadmap"""
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.user_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return roadmap


@router.put("/{roadmap_id}/quarterly-checkin", response_model=RoadmapOut)
def update_quarterly_checkin(roadmap_id: int, roadmap_update: RoadmapUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update quarterly check-in (only every 3 months)"""
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.user_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    
    # Determine which quarter we're in
    now = datetime.utcnow()
    current_month = now.month
    
    # Validate conclusion length (100-500 words)
    update_data = roadmap_update.dict(exclude_unset=True)
    
    for key in ['q1_conclusion', 'q2_conclusion', 'q3_conclusion', 'q4_conclusion']:
        if key in update_data and update_data[key]:
            word_count = len(update_data[key].split())
            if word_count < 100 or word_count > 500:
                raise HTTPException(
                    status_code=400,
                    detail=f"Conclusion must be between 100 and 500 words. Current: {word_count} words."
                )
    
    # Check if we can update this quarter
    quarter = (current_month - 1) // 3 + 1
    quarter_date_field = f"q{quarter}_date"
    
    # Allow update only at the end of the quarter or if not yet filled
    if quarter_date_field in update_data:
        last_checkin = getattr(roadmap, quarter_date_field)
        if last_checkin:
            time_since_checkin = now - last_checkin
            if time_since_checkin < timedelta(days=90):
                raise HTTPException(
                    status_code=400,
                    detail=f"You can only update quarterly check-ins every 3 months."
                )
    
    for key, value in update_data.items():
        setattr(roadmap, key, value)
    
    roadmap.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.post("/{roadmap_id}/archive")
def archive_roadmap(roadmap_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Archive a roadmap"""
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.user_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    
    roadmap.is_archived = True
    roadmap.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Roadmap archived successfully"}


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(roadmap_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete roadmap"""
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.user_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    
    db.delete(roadmap)
    db.commit()
    return
