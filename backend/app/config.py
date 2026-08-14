import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
EMAIL_VERIFICATION_EXPIRE_MINUTES = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_MINUTES", "60"))

# Production/runtime storage is the Task Manager Supabase Postgres project.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ALLOW_SQLITE_FOR_TESTS = os.getenv("ALLOW_SQLITE_FOR_TESTS", "").strip().lower() in {
    "1",
    "true",
    "yes",
}
# Supavisor session mode is IPv4-compatible and supports SQLAlchemy's persistent
# connection pool. The direct db.<project>.supabase.co endpoint is IPv6-only
# unless the project has Supabase's dedicated IPv4 add-on.
SUPABASE_DB_HOST = os.getenv(
    "SUPABASE_DB_HOST", "aws-1-eu-west-1.pooler.supabase.com"
)
SUPABASE_DB_PORT = int(os.getenv("SUPABASE_DB_PORT", "5432"))
SUPABASE_DB_NAME = os.getenv("SUPABASE_DB_NAME", "postgres")
SUPABASE_DB_USER = os.getenv(
    "SUPABASE_DB_USER", "postgres.mvxkssrpxaldmiknozoz"
)
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:4200,tauri://localhost,http://tauri.localhost",
    ).split(",")
    if origin.strip()
]

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
APPLE_CLIENT_ID = os.getenv("APPLE_CLIENT_ID", "")

# Brevo is the only transactional email provider used by this app.
BREVO_SMTP_SERVER = os.getenv("BREVO_SMTP_SERVER", "smtp-relay.brevo.com")
_configured_brevo_smtp_port = int(os.getenv("BREVO_SMTP_PORT", "587"))
# Render Free blocks standard SMTP ports; Brevo explicitly supports 2525 as
# the submission alternative when 587 is unavailable.
BREVO_SMTP_PORT = (
    2525
    if os.getenv("RENDER", "").lower() == "true"
    and _configured_brevo_smtp_port in {25, 465, 587}
    else _configured_brevo_smtp_port
)
BREVO_SMTP_LOGIN = os.getenv("BREVO_SMTP_LOGIN", "")
BREVO_SMTP_KEY = os.getenv("BREVO_SMTP_KEY", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_NAME = os.getenv("SENDER_NAME", "Task Manager")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", SENDER_EMAIL)
APP_URL = os.getenv("APP_URL", "http://localhost:4200").rstrip("/")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000").rstrip("/")
