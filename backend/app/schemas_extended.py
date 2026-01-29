from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import json


# --- User & Profile Schemas ---

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
    bio: Optional[str] = None
    profile_picture: Optional[str] = None


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfileOut(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserUpdateExtended(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


# --- Challenge Schemas ---

class ChallengeBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration: int
    challenge_type: Optional[str] = None
    xp_reward: Optional[int] = 100
    icon: Optional[str] = "fas fa-trophy"


class ChallengeCreate(ChallengeBase):
    pass


class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    challenge_type: Optional[str] = None
    xp_reward: Optional[int] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class ChallengeCheckIn(BaseModel):
    challenge_id: int


class ChallengeOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    duration: int
    challenge_type: Optional[str]
    start_date: datetime
    current_streak: int
    best_streak: int
    last_check_in: Optional[datetime]
    completed: bool
    xp_reward: int
    icon: str
    progress: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Project Schemas ---

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    duration: str
    end_date: Optional[datetime] = None
    milestones: Optional[List[Dict[str, Any]]] = []


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    duration: Optional[str] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    progress: Optional[float] = None
    milestones: Optional[List[Dict[str, Any]]] = None
    is_archived: Optional[bool] = None


class ProjectOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    category: Optional[str]
    duration: str
    start_date: datetime
    end_date: Optional[datetime]
    status: str
    progress: float
    milestones: Optional[List[Dict[str, Any]]]
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Roadmap Schemas ---

class QuarterlyCheckIn(BaseModel):
    date: datetime
    accomplishments: List[str]
    conclusion: str


class RoadmapBase(BaseModel):
    title: str
    description: Optional[str] = None
    year: int


class RoadmapCreate(RoadmapBase):
    pass


class RoadmapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_archived: Optional[bool] = None
    q1_date: Optional[datetime] = None
    q1_accomplishments: Optional[List[str]] = None
    q1_conclusion: Optional[str] = None
    q2_date: Optional[datetime] = None
    q2_accomplishments: Optional[List[str]] = None
    q2_conclusion: Optional[str] = None
    q3_date: Optional[datetime] = None
    q3_accomplishments: Optional[List[str]] = None
    q3_conclusion: Optional[str] = None
    q4_date: Optional[datetime] = None
    q4_accomplishments: Optional[List[str]] = None
    q4_conclusion: Optional[str] = None


class RoadmapOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    year: int
    start_date: datetime
    end_date: datetime
    q1_date: Optional[datetime]
    q1_accomplishments: Optional[List[str]]
    q1_conclusion: Optional[str]
    q2_date: Optional[datetime]
    q2_accomplishments: Optional[List[str]]
    q2_conclusion: Optional[str]
    q3_date: Optional[datetime]
    q3_accomplishments: Optional[List[str]]
    q3_conclusion: Optional[str]
    q4_date: Optional[datetime]
    q4_accomplishments: Optional[List[str]]
    q4_conclusion: Optional[str]
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Habit Schemas ---

class HabitBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = "daily"
    target_count: Optional[int] = 1
    icon: Optional[str] = None
    color: Optional[str] = None


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    target_count: Optional[int] = None
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

    class Config:
        from_attributes = True


class HabitEntryBase(BaseModel):
    habit_id: int
    date: datetime
    completed: bool = False
    count: Optional[int] = 1
    mood: Optional[int] = None
    energy: Optional[int] = None
    notes: Optional[str] = None


class HabitEntryCreate(HabitEntryBase):
    pass


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

    class Config:
        from_attributes = True


# --- Diet & Hydration Schemas ---

class DietPreferenceBase(BaseModel):
    preference_type: Optional[str] = None
    allergies: Optional[List[str]] = []
    dislikes: Optional[List[str]] = []
    health_goals: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    water_target_ml: Optional[int] = 2000


class DietPreferenceCreate(DietPreferenceBase):
    pass


class DietPreferenceUpdate(DietPreferenceBase):
    pass


class DietPreferenceOut(DietPreferenceBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MealEntryBase(BaseModel):
    meal_type: str  # breakfast, lunch, dinner, snack
    description: str
    calories: Optional[int] = None


class MealEntryCreate(MealEntryBase):
    pass


class MealEntryOut(BaseModel):
    id: int
    user_id: int
    date: datetime
    meal_type: str
    meal_time: datetime
    description: str
    calories: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class WaterEntryCreate(BaseModel):
    amount_ml: int


class WaterEntryOut(BaseModel):
    id: int
    user_id: int
    date: datetime
    time: datetime
    amount_ml: int
    created_at: datetime

    class Config:
        from_attributes = True


class DailyMealPlan(BaseModel):
    breakfast: List[str]
    lunch: List[str]
    dinner: List[str]
    snacks: List[str]
    tips: List[str]


# --- AI Assistant Schemas ---

class AIQuestionCreate(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = {}


class AIConversationOut(BaseModel):
    id: int
    user_id: int
    question: str
    answer: str
    context: Optional[Dict[str, Any]]
    feedback: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AIFeedback(BaseModel):
    conversation_id: int
    feedback: int  # 1-5 rating


# --- Gamification Schemas ---

class UserStatisticsOut(BaseModel):
    id: int
    user_id: int
    level: int
    total_xp: int
    xp_to_next_level: int
    challenges_completed: int
    projects_completed: int
    current_streak: int
    best_streak: int
    badges: Optional[List[Dict[str, Any]]]
    rank: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class XPUpdate(BaseModel):
    amount: int
    reason: str


# --- Analytics Schemas ---

class HabitAnalytics(BaseModel):
    total_habits: int
    active_habits: int
    completion_rate: float
    best_performing_habits: List[Dict[str, Any]]
    insights: List[str]
    predictions: List[str]


class DietAnalytics(BaseModel):
    total_meals_logged: int
    water_intake_today: int
    water_goal_percentage: float
    average_calories: int
    meal_distribution: Dict[str, int]
    hydration_streak: int
