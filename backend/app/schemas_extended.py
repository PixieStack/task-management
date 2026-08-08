from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class UserProfileBase(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    occupation: Optional[str] = None
    company: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)
    profile_picture: Optional[str] = None

class UserProfileCreate(UserProfileBase): pass
class UserProfileUpdate(UserProfileBase): pass

class UserProfileOut(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True

class ChallengeBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    duration: int = Field(ge=1, le=365)
    challenge_type: str
    icon: Optional[str] = None
    @field_validator("challenge_type")
    @classmethod
    def validate_challenge_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"meditation", "reading"}:
            raise ValueError("Only meditation and reading challenges are supported")
        return value

class ChallengeCreate(ChallengeBase): pass

class ChallengeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=1, le=365)
    is_active: Optional[bool] = None

class ChallengeOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    duration: int
    challenge_type: str
    start_date: datetime
    current_streak: int
    best_streak: int
    last_check_in: Optional[datetime]
    completed: bool
    icon: str
    progress: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True

class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: str = "daily"
    target_count: int = Field(default=1, ge=1, le=1000)
    icon: Optional[str] = None
    color: Optional[str] = None
    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"daily", "weekly"}:
            raise ValueError("frequency must be daily or weekly")
        return value

class HabitCreate(HabitBase): pass

class HabitUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_count: Optional[int] = Field(default=None, ge=1, le=1000)
    icon: Optional[str] = None
    color: Optional[str] = None

class HabitOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    frequency: str
    target_count: int
    icon: Optional[str]
    color: Optional[str]
    created_at: datetime
    class Config: from_attributes = True

class HabitEntryCreate(BaseModel):
    habit_id: int
    date: datetime
    completed: bool = False
    count: int = Field(default=1, ge=0)
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = Field(default=None, max_length=1000)

class HabitEntryOut(BaseModel):
    id: int
    habit_id: int
    user_id: int
    date: datetime
    completed: bool
    count: int
    mood: Optional[int]
    energy: Optional[int]
    notes: Optional[str]
    created_at: datetime
    class Config: from_attributes = True

class AIQuestionCreate(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: Dict[str, Any] = Field(default_factory=dict)

class AIConversationOut(BaseModel):
    id: int
    user_id: int
    question: str
    answer: str
    context: Optional[Dict[str, Any]]
    feedback: Optional[int]
    created_at: datetime
    class Config: from_attributes = True

class AIFeedback(BaseModel):
    conversation_id: int
    feedback: int = Field(ge=1, le=5)
