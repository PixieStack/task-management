from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime)
    auth_version = Column(Integer, default=0, nullable=False)
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
    tags = Column(String, default="[]")
    time_estimate = Column(Integer, default=0)
    time_spent = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="tasks")


class DailyTodo(Base):
    __tablename__ = "daily_todos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(250), nullable=False)
    notes = Column(Text)
    todo_date = Column(Date, default=date.today, nullable=False, index=True)
    completed = Column(Boolean, default=False, nullable=False)
    priority = Column(String(20), default="Medium", nullable=False)
    time_spent_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User")


class TimeSession(Base):
    __tablename__ = "time_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_type = Column(String(20), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    todo_id = Column(Integer, ForeignKey("daily_todos.id", ondelete="CASCADE"))
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime)
    elapsed_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    task = relationship("Task")
    todo = relationship("DailyTodo")


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


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
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
    profile_picture = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    duration = Column(Integer, nullable=False)
    challenge_type = Column(String(50), nullable=False)
    start_date = Column(DateTime, nullable=False)
    current_streak = Column(Integer, default=0)
    best_streak = Column(Integer, default=0)
    last_check_in = Column(DateTime)
    completed = Column(Boolean, default=False)
    xp_reward = Column(Integer, default=0)
    icon = Column(String(100), default="fas fa-bullseye")
    progress = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    frequency = Column(String(50), default="daily")
    target_count = Column(Integer, default=1)
    icon = Column(String(100))
    color = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class HabitEntry(Base):
    __tablename__ = "habit_entries"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    completed = Column(Boolean, default=False)
    count = Column(Integer, default=1)
    mood = Column(Integer)
    energy = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    habit = relationship("Habit")
    user = relationship("User")


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context = Column(JSON)
    feedback = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")


class OAuthIdentity(Base):
    __tablename__ = "oauth_identities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False)
    provider_subject = Column(String(255), nullable=False)
    provider_email = Column(String(320))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User")
