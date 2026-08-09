alter table public.users add column if not exists email_verified boolean;
alter table public.users add column if not exists email_verified_at timestamp without time zone;

-- Existing accounts predate mandatory verification, so preserve their access.
update public.users
set email_verified = true,
    email_verified_at = coalesce(email_verified_at, created_at, now() at time zone 'utc')
where email_verified is null;

alter table public.users alter column email_verified set default false;
alter table public.users alter column email_verified set not null;

create table if not exists public.email_verification_tokens (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  token_hash varchar(64) not null unique,
  expires_at timestamp without time zone not null,
  used_at timestamp without time zone,
  created_at timestamp without time zone not null default (now() at time zone 'utc')
);

create index if not exists ix_email_verification_tokens_user_id
  on public.email_verification_tokens(user_id);
create index if not exists ix_email_verification_tokens_expires_at
  on public.email_verification_tokens(expires_at);

create table if not exists public.oauth_identities (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  provider varchar(20) not null,
  provider_subject varchar(255) not null,
  provider_email varchar(320),
  created_at timestamp without time zone not null default (now() at time zone 'utc'),
  updated_at timestamp without time zone not null default (now() at time zone 'utc'),
  constraint oauth_identities_provider_check check (provider in ('google', 'apple')),
  constraint oauth_identities_provider_subject_unique unique (provider, provider_subject)
);

create index if not exists ix_oauth_identities_user_id on public.oauth_identities(user_id);
create unique index if not exists ux_oauth_identities_user_provider
  on public.oauth_identities(user_id, provider);

alter table public.email_verification_tokens enable row level security;
alter table public.oauth_identities enable row level security;
revoke all on table public.email_verification_tokens from anon, authenticated;
revoke all on table public.oauth_identities from anon, authenticated;
