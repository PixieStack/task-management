alter table public.users add column if not exists deleted_at timestamp without time zone;
alter table public.tasks add column if not exists deleted_at timestamp without time zone;
alter table public.daily_todos add column if not exists deleted_at timestamp without time zone;
alter table public.time_sessions add column if not exists deleted_at timestamp without time zone;
alter table public.habits add column if not exists deleted_at timestamp without time zone;
alter table public.habit_entries add column if not exists deleted_at timestamp without time zone;
alter table public.challenges add column if not exists deleted_at timestamp without time zone;
alter table public.projects add column if not exists deleted_at timestamp with time zone;

create index if not exists ix_users_deleted_at on public.users (deleted_at);
create index if not exists ix_tasks_deleted_at on public.tasks (deleted_at);
create index if not exists ix_daily_todos_deleted_at on public.daily_todos (deleted_at);
create index if not exists ix_time_sessions_deleted_at on public.time_sessions (deleted_at);
create index if not exists ix_habits_deleted_at on public.habits (deleted_at);
create index if not exists ix_habit_entries_deleted_at on public.habit_entries (deleted_at);
create index if not exists ix_challenges_deleted_at on public.challenges (deleted_at);
create index if not exists ix_projects_deleted_at on public.projects (deleted_at);
