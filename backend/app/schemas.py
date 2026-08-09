import json
import re
from datetime import datetime
from typing import List, Optional, Union

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=80)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class EmailChange(BaseModel):
    new_email: EmailStr
    password: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirm_phrase: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: Optional[str] = ""
    completed: bool = False
    status: str = "Not Started"
    priority: str = "Medium"
    due_date: Optional[Union[datetime, str]] = None
    tags: List[str] = Field(default_factory=list)
    time_estimate: int = Field(default=0, ge=0)
    time_spent: int = Field(default=0, ge=0)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        allowed = {"Not Started", "In Progress", "Pending", "Completed"}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        allowed = {"Low", "Medium", "High"}
        if value not in allowed:
            raise ValueError("priority must be Low, Medium, or High")
        return value


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=250)
    description: Optional[str] = None
    completed: Optional[bool] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[Union[datetime, str]] = None
    tags: Optional[List[str]] = None
    time_estimate: Optional[int] = Field(default=None, ge=0)
    time_spent: Optional[int] = Field(default=None, ge=0)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        allowed = {"Not Started", "In Progress", "Pending", "Completed"}
        if value not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in {"Low", "Medium", "High"}:
            raise ValueError("priority must be Low, Medium, or High")
        return value


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    completed: bool
    status: str
    priority: str
    due_date: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    time_estimate: int = 0
    time_spent: int = 0
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, value):
        if isinstance(value, str):
            try:
                parsed = json.loads(value) if value else []
                return parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                return []
        return value or []


class ContactMessageCreate(BaseModel):
    firstName: str = Field(min_length=2, max_length=50)
    lastName: str = Field(min_length=2, max_length=50)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=20)
    message: str = Field(min_length=10, max_length=5000)


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


class TaskAnalytics(BaseModel):
    total_tasks: int
    completed_tasks: int
    completion_rate: float
    total_time_spent: int
    overdue_tasks: int
    tasks_by_status: dict
    tasks_by_priority: dict
    productivity_trend: List[dict]


def is_strong_password(password: str) -> bool:
    return all(
        [
            len(password) >= 8,
            bool(re.search(r"[A-Z]", password)),
            bool(re.search(r"[a-z]", password)),
            bool(re.search(r"\d", password)),
            bool(re.search(r"[^A-Za-z0-9]", password)),
        ]
    )
