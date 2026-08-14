from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.archive_logic import archive_completed_items, set_completion_state
from app.auth import get_current_user, get_db
from app.email_service import send_project_completion_email
from app.schemas_extended import (
    ProjectCategoryCreate,
    ProjectCategoryOut,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _get_project(project_id: int, user_id: int, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == user_id,
        models.Project.deleted_at.is_(None),
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=List[ProjectOut])
def get_projects(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    archive_completed_items(db, current_user.id)
    return db.query(models.Project).filter(
        models.Project.user_id == current_user.id,
        models.Project.deleted_at.is_(None),
    ).order_by(models.Project.updated_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = models.Project(user_id=current_user.id, status="in_progress", **data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/categories", response_model=List[ProjectCategoryOut])
def get_project_categories(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.ProjectCategory).filter(
        models.ProjectCategory.user_id == current_user.id,
    ).order_by(models.ProjectCategory.name.asc()).all()


@router.post("/categories", response_model=ProjectCategoryOut, status_code=status.HTTP_201_CREATED)
def create_project_category(data: ProjectCategoryCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized_name = data.name.casefold()
    existing = db.query(models.ProjectCategory).filter(
        models.ProjectCategory.user_id == current_user.id,
        models.ProjectCategory.normalized_name == normalized_name,
    ).first()
    if existing:
        return existing
    category = models.ProjectCategory(
        user_id=current_user.id,
        name=data.name,
        normalized_name=normalized_name,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(models.ProjectCategory).filter(
            models.ProjectCategory.user_id == current_user.id,
            models.ProjectCategory.normalized_name == normalized_name,
        ).one()
    db.refresh(category)
    return category


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectUpdate, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = _get_project(project_id, current_user.id, db)
    was_complete = project.status == "complete"
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    set_completion_state(project, project.status == "complete")
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    if project.status == "complete" and not was_complete:
        background_tasks.add_task(send_project_completion_email, current_user.email, current_user.username, project.title)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = _get_project(project_id, current_user.id, db)
    project.deleted_at = datetime.utcnow()
    project.updated_at = project.deleted_at
    db.commit()
    return None
