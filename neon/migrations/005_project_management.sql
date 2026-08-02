alter table public.projects add column if not exists project_code text;
alter table public.projects add column if not exists client_name text;
alter table public.projects add column if not exists contract_amount numeric(15,2);
alter table public.projects add column if not exists planned_mm numeric(8,3);

create table if not exists public.project_assignments (
  user_id text not null references public.app_users(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  planned_mm numeric(8,3) not null default 0,
  assigned_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

insert into public.project_assignments (user_id, project_id)
select distinct user_id, project_id from public.timesheet_entries
where project_id is not null
on conflict do nothing;
