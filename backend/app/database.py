from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import (
    DATABASE_URL,
    SUPABASE_DB_HOST,
    SUPABASE_DB_NAME,
    SUPABASE_DB_PASSWORD,
    SUPABASE_DB_PORT,
    SUPABASE_DB_USER,
)


def _build_database_url():
    if DATABASE_URL:
        return DATABASE_URL

    if not SUPABASE_DB_PASSWORD:
        raise RuntimeError(
            "SUPABASE_DB_PASSWORD is required. Set it in backend/.env or the deployment environment. "
            "DATABASE_URL may be used only as an explicit override, such as CI tests."
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

# SQLite is supported only when explicitly supplied through DATABASE_URL for tests.
if str(DATABASE_CONNECTION).startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(DATABASE_CONNECTION, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
