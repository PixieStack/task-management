update public.projects
set status = 'in_progress', updated_at = now()
where status = 'created';

alter table public.projects
  alter column status set default 'in_progress';

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('in_progress', 'under_review', 'complete'));
