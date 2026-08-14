alter table public.users
  add column if not exists is_admin boolean not null default false,
  add column if not exists last_login_at timestamp without time zone,
  add column if not exists last_active_at timestamp without time zone;

create table if not exists public.deleted_accounts (
  id bigserial primary key,
  original_user_id integer,
  username varchar(255) not null,
  email varchar(320) not null,
  account_created_at timestamp without time zone,
  deleted_at timestamp without time zone not null default (now() at time zone 'utc'),
  deletion_reason varchar(255) not null default 'User requested deletion'
);

create index if not exists ix_deleted_accounts_deleted_at
  on public.deleted_accounts(deleted_at desc);
create index if not exists ix_deleted_accounts_email
  on public.deleted_accounts(email);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  admin_user_id integer references public.users(id) on delete set null,
  action varchar(120) not null,
  target_type varchar(80),
  target_id varchar(120),
  details jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default (now() at time zone 'utc')
);

create index if not exists ix_admin_audit_logs_created_at
  on public.admin_audit_logs(created_at desc);
create index if not exists ix_admin_audit_logs_admin_user_id
  on public.admin_audit_logs(admin_user_id);

alter table public.deleted_accounts enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on table public.deleted_accounts from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;

create or replace function public.archive_deleted_task_manager_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_accounts (
    original_user_id,
    username,
    email,
    account_created_at,
    deleted_at,
    deletion_reason
  ) values (
    old.id,
    old.username,
    old.email,
    old.created_at,
    now() at time zone 'utc',
    'User requested deletion'
  );
  return old;
end;
$$;

drop trigger if exists trg_archive_deleted_task_manager_account on public.users;
create trigger trg_archive_deleted_task_manager_account
before delete on public.users
for each row execute function public.archive_deleted_task_manager_account();
