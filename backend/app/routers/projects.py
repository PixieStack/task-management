from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from app import models
from app.schemas_extended import ProjectCreate, ProjectUpdate, ProjectOut
from app.auth import get_current_user, get_db

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new project"""
    start_date = datetime.utcnow()
    
    # Calculate end date based on duration
    if "3 month" in project.duration.lower():
        end_date = start_date + timedelta(days=90)
    elif "6 month" in project.duration.lower():
        end_date = start_date + timedelta(days=180)
    else:
        end_date = project.end_date or start_date + timedelta(days=90)
    
    db_project = models.Project(
        user_id=current_user.id,
        title=project.title,
        description=project.description,
        category=project.category,
        duration=project.duration,
        start_date=start_date,
        end_date=end_date,
        milestones=project.milestones or []
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/", response_model=List[ProjectOut])
def get_projects(include_archived: bool = False, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all projects for current user"""
    query = db.query(models.Project).filter(models.Project.user_id == current_user.id)
    
    if not include_archived:
        query = query.filter(models.Project.is_archived == False)
    
    projects = query.all()
    return projects


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get specific project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, project_update: ProjectUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/archive")
def archive_project(project_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Archive a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.is_archived = True
    project.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Project archived successfully"}


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return
