# Backend smoke coverage

- `smoke.py`: registration verification, login, password reset/change, profile, tasks, analytics, habits, reading challenges, projects, contact and account deletion.
- `productivity_smoke.py`: Daily Todos, persistent task/todo timers and AI action execution.
- `auth_verification_oauth_smoke.py`: Brevo verification-delivery rollback, mandatory email verification, resend token rotation, and confirmation that third-party sign-in routes remain disabled.

CI uses explicit SQLite only as an isolated test database with `ALLOW_SQLITE_FOR_TESTS=true`. Normal runtime uses Supabase PostgreSQL.
