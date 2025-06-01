from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Union
from datetime import datetime
import json

# --- User ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True  

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# --- Token ---
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: Optional[int] = None
    user: Optional[UserOut] = None

# --- Task ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = ""
    completed: Optional[bool] = False
    status: Optional[str] = "Not Started"
    priority: Optional[str] = "Medium"
    due_date: Optional[Union[datetime, str]] = None
    tags: Optional[List[str]] = []
    time_estimate: Optional[int] = 0
    time_spent: Optional[int] = 0

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[Union[datetime, str]] = None
    tags: Optional[List[str]] = None
    time_estimate: Optional[int] = None
    time_spent: Optional[int] = None

class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    completed: bool
    status: Optional[str] = "Not Started"
    priority: Optional[str] = "Medium"
    due_date: Optional[datetime] = None
    tags: Optional[Union[str, List[str]]] = []
    time_estimate: Optional[int] = 0
    time_spent: Optional[int] = 0
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  

    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v) if v else []
            except json.JSONDecodeError:
                return []
        return v or []

# --- Contact ---
class ContactMessageCreate(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: str
    message: str

class ContactMessageOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    message: str
    is_read: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ContactMessageResponse(BaseModel):
    success: bool
    message: str
    contact_id: Optional[int] = None

# --- Analytics ---
class TaskAnalytics(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    total_time_spent: int
    overdue_tasks: int
    tasks_by_status: dict
    tasks_by_priority: dict
    productivity_trend: List[dict]