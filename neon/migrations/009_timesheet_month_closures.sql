create table if not exists public.timesheet_month_closures (
  user_id text not null references public.app_users(id) on delete cascade,
  year_month date not null,
  is_locked boolean not null default true,
  closed_at timestamptz,
  closed_by text references public.app_users(id),
  reopened_at timestamptz,
  reopened_by text references public.app_users(id),
  primary key (user_id, year_month)
);

create index if not exists timesheet_month_closures_month_idx
  on public.timesheet_month_closures(year_month, is_locked);
