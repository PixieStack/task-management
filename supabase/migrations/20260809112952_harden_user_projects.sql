-- FastAPI owns authentication and connects through a trusted database role.
-- RLS intentionally has no PostgREST policies, so browser-facing roles cannot
-- access project data even if table privileges are changed later.
alter table public.projects enable row level security;
alter table public.project_categories enable row level security;
