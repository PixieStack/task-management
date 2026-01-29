from datetime import datetime
from .database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    first_name = Column(String(100))
    last_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    completed = Column(Boolean, default=False)
    status = Column(String, default="Not Started")  
    priority = Column(String, default="Medium")  
    due_date = Column(DateTime)
    tags = Column(String)  
    time_estimate = Column(Integer, default=0)  
    time_spent = Column(Integer, default=0)    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="tasks")


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Extended Models for new features

class UserProfile(Base):
    """Extended user profile information"""
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone = Column(String(20))
    address = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    country = Column(String(100))
    gender = Column(String(50))
    date_of_birth = Column(DateTime)
    occupation = Column(String(150))
    company = Column(String(150))
    bio = Column(Text)
    profile_picture = Column(Text)  # Base64 encoded image
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="profile")


class Challenge(Base):
    """21-30 day challenges"""
    __tablename__ = "challenges"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    duration = Column(Integer, nullable=False)  # days (21-30 or custom)
    challenge_type = Column(String(50))  # eating, meditation, exercise, etc.
    start_date = Column(DateTime, nullable=False)
    current_streak = Column(Integer, default=0)
    best_streak = Column(Integer, default=0)
    last_check_in = Column(DateTime)  # Track last check-in for 24hr restriction
    completed = Column(Boolean, default=False)
    xp_reward = Column(Integer, default=100)
    icon = Column(String(100), default="fas fa-trophy")
    progress = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="challenges")


class Project(Base):
    """Long-term projects (3-6 months)"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # Generalized categories
    duration = Column(String(50))  # "3 months", "6 months", etc.
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    status = Column(String(50), default="Planning")  # Planning, Active, On Hold, Completed
    progress = Column(Float, default=0.0)
    milestones = Column(JSON)  # Store milestones as JSON
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="projects")


class Roadmap(Base):
    """12-month roadmaps (quarterly tracking)"""
    __tablename__ = "roadmaps"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    year = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    # Quarterly check-ins
    q1_date = Column(DateTime)
    q1_accomplishments = Column(JSON)  # List of accomplishments
    q1_conclusion = Column(Text)  # 100-500 words
    
    q2_date = Column(DateTime)
    q2_accomplishments = Column(JSON)
    q2_conclusion = Column(Text)
    
    q3_date = Column(DateTime)
    q3_accomplishments = Column(JSON)
    q3_conclusion = Column(Text)
    
    q4_date = Column(DateTime)
    q4_accomplishments = Column(JSON)
    q4_conclusion = Column(Text)
    
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="roadmaps")


class Habit(Base):
    """Daily habits tracking"""
    __tablename__ = "habits"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    frequency = Column(String(50), default="daily")  # daily, weekly, etc.
    target_count = Column(Integer, default=1)
    icon = Column(String(100))
    color = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="habits")


class HabitEntry(Base):
    """Individual habit tracking entries"""
    __tablename__ = "habit_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    completed = Column(Boolean, default=False)
    count = Column(Integer, default=1)
    mood = Column(Integer)  # 1-5 scale
    energy = Column(Integer)  # 1-5 scale
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    habit = relationship("Habit")
    user = relationship("User")


class DietPreference(Base):
    """User's diet preferences"""
    __tablename__ = "diet_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    preference_type = Column(String(100))  # vegetarian, vegan, keto, etc.
    allergies = Column(JSON)  # List of allergies
    dislikes = Column(JSON)  # Foods user doesn't like
    health_goals = Column(Text)
    daily_calorie_target = Column(Integer)
    water_target_ml = Column(Integer, default=2000)  # Daily water goal
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="diet_preference")


class MealEntry(Base):
    """Meal logging"""
    __tablename__ = "meal_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    meal_type = Column(String(50), nullable=False)  # breakfast, lunch, dinner, snack
    meal_time = Column(DateTime, nullable=False)
    description = Column(Text)
    calories = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="meals")


class WaterEntry(Base):
    """Water intake logging"""
    __tablename__ = "water_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    time = Column(DateTime, nullable=False)
    amount_ml = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="water_logs")


class AIConversation(Base):
    """AI assistant conversation history and learning"""
    __tablename__ = "ai_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context = Column(JSON)  # Store conversation context
    feedback = Column(Integer)  # User feedback (1-5 or thumbs up/down)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="ai_conversations")


class UserStatistics(Base):
    """Gamification and user statistics"""
    __tablename__ = "user_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    level = Column(Integer, default=1)
    total_xp = Column(Integer, default=0)
    xp_to_next_level = Column(Integer, default=2000)  # 2000 XP per level
    challenges_completed = Column(Integer, default=0)
    projects_completed = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    best_streak = Column(Integer, default=0)
    badges = Column(JSON)  # List of earned badges
    rank = Column(String(50), default="Beginner")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="statistics")


class MLTrainingData(Base):
    """Store ML training data for habit analytics"""
    __tablename__ = "ml_training_data"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    data_type = Column(String(100))  # habit_pattern, meal_preference, etc.
    features = Column(JSON)  # Feature data for ML
    labels = Column(JSON)  # Labels/outcomes
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
