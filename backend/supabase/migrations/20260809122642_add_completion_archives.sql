alter table public.tasks
  add column if not exists completed_at timestamp without time zone,
  add column if not exists archived_at timestamp without time zone;

alter table public.daily_todos
  add column if not exists completed_at timestamp without time zone,
  add column if not exists archived_at timestamp without time zone;

alter table public.habits
  add column if not exists archived_at timestamp without time zone;

alter table public.challenges
  add column if not exists completed_at timestamp without time zone,
  add column if not exists archived_at timestamp without time zone;

alter table public.projects
  add column if not exists completed_at timestamp with time zone,
  add column if not exists archived_at timestamp with time zone;

update public.tasks
set completed_at = coalesce(completed_at, updated_at, created_at)
where completed is true and completed_at is null;

update public.daily_todos
set completed_at = coalesce(completed_at, updated_at, created_at)
where completed is true and completed_at is null;

update public.habits
set completed_at = coalesce(completed_at, created_at)
where completed is true and completed_at is null;

update public.challenges
set completed_at = coalesce(completed_at, updated_at, created_at)
where completed is true and completed_at is null;

update public.projects
set completed_at = coalesce(completed_at, updated_at, created_at)
where status = 'complete' and completed_at is null;

update public.tasks set archived_at = now() where completed_at <= now() - interval '60 days' and archived_at is null and deleted_at is null;
update public.daily_todos set archived_at = now() where completed_at <= now() - interval '60 days' and archived_at is null and deleted_at is null;
update public.habits set archived_at = now() where completed_at <= now() - interval '60 days' and archived_at is null and deleted_at is null;
update public.challenges set archived_at = now() where completed_at <= now() - interval '60 days' and archived_at is null and deleted_at is null;
update public.projects set archived_at = now() where completed_at <= now() - interval '60 days' and archived_at is null and deleted_at is null;

create index if not exists ix_tasks_completed_at on public.tasks (completed_at);
create index if not exists ix_tasks_archived_at on public.tasks (archived_at);
create index if not exists ix_daily_todos_completed_at on public.daily_todos (completed_at);
create index if not exists ix_daily_todos_archived_at on public.daily_todos (archived_at);
create index if not exists ix_habits_archived_at on public.habits (archived_at);
create index if not exists ix_challenges_completed_at on public.challenges (completed_at);
create index if not exists ix_challenges_archived_at on public.challenges (archived_at);
create index if not exists ix_projects_completed_at on public.projects (completed_at);
create index if not exists ix_projects_archived_at on public.projects (archived_at);
