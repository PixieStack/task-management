alter table public.tasks
  add column if not exists time_spent_seconds integer not null default 0;

update public.tasks
set time_spent_seconds = greatest(coalesce(time_spent, 0), 0) * 60
where time_spent_seconds = 0 and coalesce(time_spent, 0) > 0;

create table if not exists public.daily_todos (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  title varchar(250) not null,
  notes text,
  todo_date date not null default current_date,
  completed boolean not null default false,
  priority varchar(20) not null default 'Medium',
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  created_at timestamp without time zone not null default (now() at time zone 'utc'),
  updated_at timestamp without time zone not null default (now() at time zone 'utc'),
  constraint daily_todos_priority_check check (priority in ('Low', 'Medium', 'High'))
);

create index if not exists ix_daily_todos_user_date
  on public.daily_todos(user_id, todo_date, completed, created_at);

create table if not exists public.time_sessions (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  item_type varchar(20) not null,
  task_id integer references public.tasks(id) on delete cascade,
  todo_id integer references public.daily_todos(id) on delete cascade,
  started_at timestamp without time zone not null default (now() at time zone 'utc'),
  ended_at timestamp without time zone,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  created_at timestamp without time zone not null default (now() at time zone 'utc'),
  constraint time_sessions_item_type_check check (item_type in ('task', 'todo')),
  constraint time_sessions_item_link_check check (
    (item_type = 'task' and task_id is not null and todo_id is null)
    or
    (item_type = 'todo' and todo_id is not null and task_id is null)
  )
);

create index if not exists ix_time_sessions_user_started
  on public.time_sessions(user_id, started_at desc);

create index if not exists ix_time_sessions_task
  on public.time_sessions(task_id) where task_id is not null;

create index if not exists ix_time_sessions_todo
  on public.time_sessions(todo_id) where todo_id is not null;

create unique index if not exists ux_time_sessions_one_active_per_user
  on public.time_sessions(user_id)
  where ended_at is null;

alter table public.daily_todos enable row level security;
alter table public.time_sessions enable row level security;

revoke all on table public.daily_todos from anon, authenticated;
revoke all on table public.time_sessions from anon, authenticated;
