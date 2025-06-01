from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from app import models, schemas
from app.auth import get_current_user, get_db

router = APIRouter()

@router.get("/", response_model=List[schemas.TaskOut])
def read_tasks(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(None, description="Filter by task status"),
    priority_filter: Optional[str] = Query(None, description="Filter by task priority"),
    tag_filter: Optional[str] = Query(None, description="Filter by tag"),
    include_completed: bool = Query(True, description="Include completed tasks")
):
    """Get all tasks for the current user with optional filtering"""
    query = db.query(models.Task).filter(models.Task.owner_id == current_user.id)
    
    if status_filter:
        query = query.filter(models.Task.status == status_filter)
    
    if priority_filter:
        query = query.filter(models.Task.priority == priority_filter)
    
    if not include_completed:
        query = query.filter(models.Task.completed == False)
    
    if tag_filter:
        # Filter by tag (this requires JSON search in SQLite/PostgreSQL)
        query = query.filter(models.Task.tags.contains(f'"{tag_filter}"'))
    
    # Order by priority and due date
    tasks = query.order_by(
        models.Task.completed.asc(),
        models.Task.due_date.asc().nullslast(),
        models.Task.priority.desc()
    ).all()
    
    return tasks

@router.post("/", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(task: schemas.TaskCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new task"""
    try:
        tags_json = json.dumps(task.tags) if task.tags else "[]"
        
        due_date = None
        if task.due_date:
            if isinstance(task.due_date, str):
                try:
                    due_date = datetime.fromisoformat(task.due_date.replace('Z', '+00:00'))
                except ValueError:
                    due_date = datetime.fromisoformat(task.due_date)
            else:
                due_date = task.due_date
        
        # Create task with explicit field mapping
        db_task = models.Task(
            title=task.title,
            description=task.description or "",
            completed=task.completed or False,
            status=task.status or "Not Started",
            priority=task.priority or "Medium",
            due_date=due_date,
            tags=tags_json,
            time_estimate=task.time_estimate or 0,
            time_spent=task.time_spent or 0,
            owner_id=current_user.id
        )
        
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        return db_task
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating task: {str(e)}")

@router.get("/{task_id}", response_model=schemas.TaskOut)
def read_task(task_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get a specific task by ID"""
    task = db.query(models.Task).filter(
        models.Task.id == task_id, 
        models.Task.owner_id == current_user.id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task

@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, updated_task: schemas.TaskUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a specific task"""
    try:
        task = db.query(models.Task).filter(
            models.Task.id == task_id, 
            models.Task.owner_id == current_user.id
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Get update data, excluding unset fields
        update_data = updated_task.dict(exclude_unset=True)
        
        if 'tags' in update_data and update_data['tags'] is not None:
            update_data['tags'] = json.dumps(update_data['tags'])
        
        if 'due_date' in update_data and update_data['due_date'] is not None:
            if isinstance(update_data['due_date'], str):
                try:
                    update_data['due_date'] = datetime.fromisoformat(update_data['due_date'].replace('Z', '+00:00'))
                except ValueError:
                    update_data['due_date'] = datetime.fromisoformat(update_data['due_date'])
        
        if 'status' in update_data and update_data['status'] == 'Completed':
            update_data['completed'] = True
        elif 'completed' in update_data and update_data['completed']:
            update_data['status'] = 'Completed'
        
        for key, value in update_data.items():
            setattr(task, key, value)
        
        task.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(task)
        return task
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error updating task: {str(e)}")

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a specific task"""
    try:
        task = db.query(models.Task).filter(
            models.Task.id == task_id, 
            models.Task.owner_id == current_user.id
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        db.delete(task)
        db.commit()
        
        return
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting task: {str(e)}")

# Endpoint for timer-specific updates
@router.patch("/{task_id}/time", response_model=schemas.TaskOut)
def update_task_time(
    task_id: int, 
    time_data: dict,
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Update task time tracking data specifically"""
    try:
        task = db.query(models.Task).filter(
            models.Task.id == task_id,
            models.Task.owner_id == current_user.id
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Update time-related fields
        if 'time_spent' in time_data:
            task.time_spent = time_data['time_spent']
        
        if 'time_estimate' in time_data:
            task.time_estimate = time_data['time_estimate']
        
        task.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(task)
        return task
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error updating task time: {str(e)}")

# Endpoint for bulk operations
@router.patch("/bulk-update", response_model=List[schemas.TaskOut])
def bulk_update_tasks(task_updates: List[dict], current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update multiple tasks at once (useful for drag & drop status changes)"""
    try:
        updated_tasks = []
        
        for update_data in task_updates:
            task_id = update_data.get('id')
            if not task_id:
                continue
                
            task = db.query(models.Task).filter(
                models.Task.id == task_id,
                models.Task.owner_id == current_user.id
            ).first()
            
            if task:
                # Handle tags conversion if present
                if 'tags' in update_data and update_data['tags'] is not None:
                    update_data['tags'] = json.dumps(update_data['tags'])
                
                # Handle due_date conversion if present
                if 'due_date' in update_data and update_data['due_date'] is not None:
                    if isinstance(update_data['due_date'], str):
                        try:
                            update_data['due_date'] = datetime.fromisoformat(update_data['due_date'].replace('Z', '+00:00'))
                        except ValueError:
                            update_data['due_date'] = datetime.fromisoformat(update_data['due_date'])
                
                # Apply updates
                for key, value in update_data.items():
                    if key != 'id' and hasattr(task, key):
                        setattr(task, key, value)
                
                task.updated_at = datetime.utcnow()
                updated_tasks.append(task)
        
        db.commit()
        
        # Refresh all updated tasks
        for task in updated_tasks:
            db.refresh(task)
            
        return updated_tasks
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error bulk updating tasks: {str(e)}")

# Enhanced task statistics endpoint
@router.get("/stats/summary")
def get_task_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get quick task statistics for the current user"""
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
    
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.completed])
    pending_tasks = total_tasks - completed_tasks
    
    # Calculate total time
    total_time_spent = sum(t.time_spent or 0 for t in tasks)
    total_time_estimated = sum(t.time_estimate or 0 for t in tasks)
    
    # Calculate overdue tasks
    today = datetime.now().date()
    overdue_tasks = len([
        t for t in tasks 
        if t.due_date and t.due_date.date() < today and not t.completed
    ])
    
    # Tasks by priority
    priority_counts = {"High": 0, "Medium": 0, "Low": 0}
    for task in tasks:
        priority = task.priority or "Medium"
        if priority in priority_counts:
            priority_counts[priority] += 1
    
    # Tasks by status
    status_counts = {}
    for task in tasks:
        status = task.status or "Not Started"
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Time efficiency calculation
    efficiency = 0
    if total_time_estimated > 0:
        efficiency = round((total_time_spent / total_time_estimated) * 100, 2)
    
    # Productivity trend (last 7 days)
    productivity_trend = []
    for i in range(7):
        date = today - timedelta(days=i)
        completed_on_date = len([
            t for t in tasks 
            if t.updated_at and t.updated_at.date() == date and t.completed
        ])
        productivity_trend.append({
            "date": date.isoformat(),
            "completed_tasks": completed_on_date
        })
    
    productivity_trend.reverse()  
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2),
        "total_time_spent": total_time_spent,
        "total_time_estimated": total_time_estimated,
        "time_efficiency": efficiency,
        "overdue_tasks": overdue_tasks,
        "priority_distribution": priority_counts,
        "status_distribution": status_counts,
        "productivity_trend": productivity_trend
    }

# New endpoint for getting active tasks (tasks in progress)
@router.get("/active", response_model=List[schemas.TaskOut])
def get_active_tasks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get tasks that are currently active (In Progress status)"""
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.status == "In Progress"
    ).order_by(models.Task.updated_at.desc()).all()
    
    return tasks

# New endpoint for getting overdue tasks
@router.get("/overdue", response_model=List[schemas.TaskOut])
def get_overdue_tasks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get tasks that are overdue"""
    today = datetime.now().date()
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.due_date < today,
        models.Task.completed == False
    ).order_by(models.Task.due_date.asc()).all()
    
    return tasks

# New endpoint for getting upcoming tasks
@router.get("/upcoming", response_model=List[schemas.TaskOut])
def get_upcoming_tasks(
    days: int = Query(7, description="Number of days to look ahead"),
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Get tasks due in the next N days"""
    today = datetime.now().date()
    future_date = today + timedelta(days=days)
    
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == current_user.id,
        models.Task.due_date >= today,
        models.Task.due_date <= future_date,
        models.Task.completed == False
    ).order_by(models.Task.due_date.asc()).all()
    
    return tasks

# Endpoint for task suggestions based on time patterns
@router.get("/suggestions")
def get_task_suggestions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get AI-powered task suggestions based on user patterns"""
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
    
    if not tasks:
        return {"suggestions": []}
    
    # Analyze user patterns
    avg_task_time = sum(t.time_spent or 0 for t in tasks if t.time_spent) / max(1, len([t for t in tasks if t.time_spent]))
    
    # Priority distribution
    priority_pattern = {}
    for task in tasks:
        priority = task.priority or "Medium"
        priority_pattern[priority] = priority_pattern.get(priority, 0) + 1
    
    most_used_priority = max(priority_pattern, key=priority_pattern.get) if priority_pattern else "Medium"
    
    suggestions = []
    
    # Suggest time estimates for tasks without them
    tasks_without_estimates = [t for t in tasks if not t.time_estimate and not t.completed]
    if tasks_without_estimates:
        suggestions.append({
            "type": "time_estimate",
            "message": f"Add time estimates to {len(tasks_without_estimates)} tasks for better planning",
            "count": len(tasks_without_estimates)
        })
    
    # Suggest completing overdue tasks
    today = datetime.now().date()
    overdue_count = len([t for t in tasks if t.due_date and t.due_date.date() < today and not t.completed])
    if overdue_count > 0:
        suggestions.append({
            "type": "overdue_tasks",
            "message": f"You have {overdue_count} overdue tasks that need attention",
            "count": overdue_count
        })
    
    # Suggest optimal work patterns
    if avg_task_time > 0:
        suggestions.append({
            "type": "work_pattern",
            "message": f"Your average task takes {int(avg_task_time)} minutes. Consider using {int(avg_task_time + 5)}-minute time blocks.",
            "average_time": int(avg_task_time)
        })
    
    return {"suggestions": suggestions}