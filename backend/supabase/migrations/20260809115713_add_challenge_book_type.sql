alter table public.challenges
  add column if not exists book_type varchar(20);

update public.challenges
set book_type = 'fiction'
where book_type is null;

alter table public.challenges
  alter column book_type set not null;

alter table public.challenges
  drop constraint if exists ck_challenges_book_type;

alter table public.challenges
  add constraint ck_challenges_book_type
  check (book_type in ('fiction', 'non_fiction'));
