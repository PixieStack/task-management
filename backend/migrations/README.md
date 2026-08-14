# Database migrations

Application runtime data is stored in the configured Supabase PostgreSQL database.

- `001_supabase_postgres.sql` creates the core application schema.
- `20260809_add_daily_todos_and_time_tracking.sql` adds Daily Todos and persistent timers.
- `20260809_add_email_verification_and_oauth.sql` adds mandatory email-verification state/tokens and Google/Apple OAuth identity links.
- `../supabase/migrations/20260809065716_habit_daily_challenges.sql` adds fixed habit durations, completion state, and the database-enforced 24-hour check-in cooldown.
- `../supabase/migrations/20260809071553_add_habit_completion_confirmation.sql` stores explicit habit completion confirmation and allows users to extend a plan before trying again.
- `../supabase/migrations/20260809112123_add_user_projects.sql` adds user-owned projects and reusable per-user project categories.
- `../supabase/migrations/20260809112952_harden_user_projects.sql` enables defense-in-depth RLS for the server-only project tables.
- `../supabase/migrations/20260809115713_add_challenge_book_type.sql` adds the required Fiction/Non-fiction classification for reading challenges.
- `../supabase/migrations/20260809120445_add_soft_delete_fields.sql` keeps deleted accounts and workspace records in PostgreSQL while hiding them from normal application queries.
- `../supabase/migrations/20260809122642_add_completion_archives.sql` records completion time and automatically archives completed workspace items after 60 days.

Supabase Auth is not used for application authentication or transactional email. FastAPI owns application authentication; Brevo SMTP sends verification/reset/account emails.

SQLite is permitted only for isolated automated tests when both an explicit SQLite `DATABASE_URL` and `ALLOW_SQLITE_FOR_TESTS=true` are provided.
