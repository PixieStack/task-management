alter table public.ai_conversations
  add column if not exists chat_id varchar(64);

update public.ai_conversations
set chat_id = 'legacy'
where chat_id is null or btrim(chat_id) = '';

alter table public.ai_conversations
  alter column chat_id set not null;

create index if not exists ix_ai_conversations_user_chat_created
  on public.ai_conversations (user_id, chat_id, created_at desc);
