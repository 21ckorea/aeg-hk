-- Run after neon/schema.sql. Keeps the prototype's JSON state table intact
-- while adding the relational model used by production intranet APIs.

create table if not exists public.app_users (
  id text primary key,
  email text not null unique,
  name text not null,
  department text,
  job_rank text,
  job_title text,
  role text not null default 'staff' check (role in ('staff', 'manager', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  work_role text,
  is_active boolean not null default true,
  manager_id text references public.app_users(id),
  started_on date,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timesheet_entries (
  id bigint generated always as identity primary key,
  user_id text not null references public.app_users(id),
  project_id text references public.projects(id),
  work_date date not null,
  hours numeric(4,1) not null check (hours >= 0 and hours <= 8),
  entry_type text not null default 'project' check (entry_type in ('project', 'vacation')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, work_date, entry_type)
);
create index if not exists timesheet_entries_user_date_idx on public.timesheet_entries(user_id, work_date);

create table if not exists public.attendance_records (
  id bigint generated always as identity primary key,
  user_id text not null references public.app_users(id),
  work_date date not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create table if not exists public.approval_documents (
  id text primary key,
  requester_id text not null references public.app_users(id),
  document_type text not null,
  title text not null,
  content text not null,
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists approval_documents_requester_idx on public.approval_documents(requester_id, created_at desc);

create table if not exists public.approval_actions (
  id bigint generated always as identity primary key,
  document_id text not null references public.approval_documents(id) on delete cascade,
  actor_id text not null references public.app_users(id),
  action text not null check (action in ('submitted', 'approved', 'rejected', 'cancelled')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id text primary key,
  author_id text not null references public.app_users(id),
  category text not null default '공지',
  title text not null,
  content text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diary_entries (
  id text primary key,
  user_id text not null references public.app_users(id),
  project_id text references public.projects(id),
  work_date date not null,
  hours numeric(4,1) not null check (hours > 0 and hours <= 24),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists diary_entries_user_date_idx on public.diary_entries(user_id, work_date);
