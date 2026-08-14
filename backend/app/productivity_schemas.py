from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


Priority = Literal["Low", "Medium", "High"]
ItemType = Literal["task", "todo"]


class DailyTodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    notes: Optional[str] = Field(default="", max_length=4000)
    todo_date: date = Field(default_factory=date.today)
    completed: bool = False
    priority: Priority = "Medium"


class DailyTodoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=250)
    notes: Optional[str] = Field(default=None, max_length=4000)
    todo_date: Optional[date] = None
    completed: Optional[bool] = None
    priority: Optional[Priority] = None


class DailyTodoOut(BaseModel):
    id: int
    user_id: int
    title: str
    notes: Optional[str] = ""
    todo_date: date
    completed: bool
    priority: Priority
    time_spent_seconds: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeSessionStart(BaseModel):
    item_type: ItemType
    item_id: int = Field(gt=0)


class TimeSessionOut(BaseModel):
    id: int
    user_id: int
    item_type: ItemType
    task_id: Optional[int] = None
    todo_id: Optional[int] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    elapsed_seconds: int
    live_elapsed_seconds: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class TimeSummary(BaseModel):
    total_seconds: int
    active_session: Optional[TimeSessionOut] = None
