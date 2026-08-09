-- Turn habits into fixed-length daily challenges with an enforced 24-hour check-in cooldown.
alter table public.habits
    add column if not exists duration_days integer not null default 21,
    add column if not exists last_check_in_at timestamp without time zone,
    add column if not exists completed_at timestamp without time zone;

update public.habits set target_count = 1 where target_count <> 1;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_habits_duration_days'
          and conrelid = 'public.habits'::regclass
    ) then
        alter table public.habits
            add constraint ck_habits_duration_days check (duration_days between 1 and 365);
    end if;
end
$$;

create or replace function public.enforce_habit_entry_24_hour_cooldown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
    if new.completed and exists (
        select 1
        from public.habit_entries existing
        where existing.habit_id = new.habit_id
          and existing.user_id = new.user_id
          and existing.completed
          and existing.id is distinct from new.id
          and existing.date > new.date - interval '24 hours'
          and existing.date < new.date + interval '24 hours'
    ) then
        raise exception 'Habit check-ins must be at least 24 hours apart'
            using errcode = '23505';
    end if;
    return new;
end;
$$;

revoke all on function public.enforce_habit_entry_24_hour_cooldown() from public, anon, authenticated;

drop trigger if exists habit_entry_24_hour_cooldown on public.habit_entries;
create trigger habit_entry_24_hour_cooldown
before insert or update of completed, date on public.habit_entries
for each row
execute function public.enforce_habit_entry_24_hour_cooldown();

create index if not exists ix_habit_entries_completed_lookup
    on public.habit_entries (habit_id, user_id, date desc)
    where completed;
