-- Habits are completed only after the user confirms the routine feels established.
alter table public.habits
    add column if not exists completed boolean not null default false;

update public.habits
set completed = (completed_at is not null);

alter table public.habits
    drop constraint if exists ck_habits_duration_days;

alter table public.habits
    add constraint ck_habits_duration_days check (duration_days between 1 and 3650);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ck_habits_completion_state'
          and conrelid = 'public.habits'::regclass
    ) then
        alter table public.habits
            add constraint ck_habits_completion_state check (
                (completed and completed_at is not null)
                or (not completed and completed_at is null)
            );
    end if;
end
$$;
