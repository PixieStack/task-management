# Database migrations

Application runtime data is stored in the configured Supabase PostgreSQL database.

- `001_supabase_postgres.sql` creates the core application schema.
- `20260809_add_daily_todos_and_time_tracking.sql` adds Daily Todos and persistent timers.
- `20260809_add_email_verification_and_oauth.sql` adds mandatory email-verification state/tokens and Google/Apple OAuth identity links.

Supabase Auth is not used for application authentication or transactional email. FastAPI owns application authentication; Brevo SMTP sends verification/reset/account emails.

SQLite is permitted only for isolated automated tests when both an explicit SQLite `DATABASE_URL` and `ALLOW_SQLITE_FOR_TESTS=true` are provided.
