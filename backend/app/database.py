from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import (
    ALLOW_SQLITE_FOR_TESTS,
    DATABASE_URL,
    SUPABASE_DB_HOST,
    SUPABASE_DB_NAME,
    SUPABASE_DB_PASSWORD,
    SUPABASE_DB_PORT,
    SUPABASE_DB_USER,
)


def _build_database_url():
    if DATABASE_URL:
        if DATABASE_URL.startswith("sqlite") and not ALLOW_SQLITE_FOR_TESTS:
            raise RuntimeError(
                "SQLite is test-only. Remove DATABASE_URL=sqlite... from backend/.env and use the Supabase Postgres settings. "
                "CI/tests must explicitly set ALLOW_SQLITE_FOR_TESTS=true."
            )
        return DATABASE_URL

    if not SUPABASE_DB_PASSWORD:
        raise RuntimeError(
            "SUPABASE_DB_PASSWORD is required. Set it in backend/.env or the deployment environment. "
            "Task Manager does not fall back to SQLite at runtime."
        )

    return URL.create(
        "postgresql+psycopg",
        username=SUPABASE_DB_USER,
        password=SUPABASE_DB_PASSWORD,
        host=SUPABASE_DB_HOST,
        port=SUPABASE_DB_PORT,
        database=SUPABASE_DB_NAME,
        query={"sslmode": "require"},
    )


DATABASE_CONNECTION = _build_database_url()
engine_kwargs = {"pool_pre_ping": True}

if str(DATABASE_CONNECTION).startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(DATABASE_CONNECTION, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
