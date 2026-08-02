create table if not exists public.project_wbs_tasks (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  category text,
  title text not null,
  started_on date not null,
  ended_on date not null,
  status text not null default 'planned' check (status in ('planned', 'progress', 'done', 'delayed')),
  note text,
  created_by text references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on >= started_on)
);

create index if not exists project_wbs_tasks_project_dates_idx
  on public.project_wbs_tasks(project_id, started_on, ended_on);
