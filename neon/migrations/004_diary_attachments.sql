create table if not exists public.diary_attachments (
  id text primary key,
  diary_id text not null references public.diary_entries(id) on delete cascade,
  uploader_id text not null references public.app_users(id),
  file_name text not null,
  content_type text,
  byte_size bigint not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists diary_attachments_diary_idx on public.diary_attachments(diary_id, created_at desc);
