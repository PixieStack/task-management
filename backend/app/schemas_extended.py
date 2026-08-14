from datetime import datetime
import base64
import binascii
import re
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
class UserProfileUpdate(UserProfileBase):
    @field_validator("profile_picture")
    @classmethod
    def validate_profile_picture(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        match = re.fullmatch(r"data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)", value, re.IGNORECASE)
        if not match:
            raise ValueError("Profile picture must be a PNG, JPG, or WebP image")
        try:
            image = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Profile picture data is invalid") from exc
        if len(image) > 2 * 1024 * 1024:
            raise ValueError("Profile picture must be smaller than 2 MB")
        mime_type = match.group(1)
        is_valid_image = (
            (mime_type.lower() == "png" and image.startswith(b"\x89PNG\r\n\x1a\n"))
            or (mime_type.lower() in {"jpg", "jpeg"} and image.startswith(b"\xff\xd8\xff"))
            or (mime_type.lower() == "webp" and image.startswith(b"RIFF") and image[8:12] == b"WEBP")
        )
        if not is_valid_image:
            raise ValueError("Profile picture content does not match its image type")
        return value

class UserProfileOut(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True

class ChallengeBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    duration: int = Field(ge=1, le=365)
    challenge_type: str
    book_type: str
    icon: Optional[str] = None

    @field_validator("title", "description")
    @classmethod
    def trim_required_challenge_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("challenge_type")
    @classmethod
    def validate_challenge_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value != "reading":
            raise ValueError("Only reading challenges are supported")
        return value

    @field_validator("book_type")
    @classmethod
    def validate_book_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"fiction", "non_fiction"}:
            raise ValueError("Book type must be fiction or non_fiction")
        return value

class ChallengeCreate(ChallengeBase): pass

class ChallengeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=1, le=365)
    book_type: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("book_type")
    @classmethod
    def validate_optional_book_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip().lower()
        if value not in {"fiction", "non_fiction"}:
            raise ValueError("Book type must be fiction or non_fiction")
        return value

class ChallengeOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    duration: int
    challenge_type: str
    book_type: str
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
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    class Config: from_attributes = True

class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: str = "daily"
    target_count: int = Field(default=1, ge=1, le=1000)
    duration_days: int = Field(default=21, ge=1, le=365)
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
    duration_days: int
    last_check_in_at: Optional[datetime]
    completed: bool
    completed_at: Optional[datetime]
    archived_at: Optional[datetime] = None
    check_in_count: int
    remaining_check_ins: int
    progress: float
    next_check_in_at: Optional[datetime]
    can_check_in: bool
    completion_review_required: bool
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

PROJECT_STATUSES = {"in_progress", "under_review", "complete"}

class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: str = Field(min_length=1, max_length=100)

    @field_validator("title", "category")
    @classmethod
    def trim_project_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    status: Optional[str] = None

    @field_validator("title", "category")
    @classmethod
    def trim_optional_project_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value

    @field_validator("status")
    @classmethod
    def validate_optional_project_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip().lower()
        if value not in PROJECT_STATUSES:
            raise ValueError("Status must be in_progress, under_review, or complete")
        return value

class ProjectOut(ProjectCreate):
    id: int
    user_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    class Config: from_attributes = True

class ProjectCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def trim_category_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Category name is required")
        return value

class ProjectCategoryOut(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    class Config: from_attributes = True

class HabitCheckInOut(BaseModel):
    habit: HabitOut
    entry: HabitEntryOut
    review_required: bool
    completion_email_queued: bool = False

class HabitCompletionReview(BaseModel):
    established: bool
    additional_days: Optional[int] = Field(default=None, ge=1, le=365)

class HabitCompletionReviewOut(BaseModel):
    habit: HabitOut
    completed_now: bool
    completion_email_queued: bool = False

class AIQuestionCreate(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: Dict[str, Any] = Field(default_factory=dict)
    chat_id: Optional[str] = Field(default=None, min_length=1, max_length=64)

class AIConversationOut(BaseModel):
    id: int
    user_id: int
    question: str
    answer: str
    context: Optional[Dict[str, Any]]
    feedback: Optional[int]
    chat_id: str
    created_at: datetime
    class Config: from_attributes = True

class AIChatOut(BaseModel):
    chat_id: str
    title: str
    updated_at: datetime
    message_count: int

class AIFeedback(BaseModel):
    conversation_id: int
    feedback: int = Field(ge=1, le=5)
