alter table public.project_assignments add column if not exists started_on date;
alter table public.project_assignments add column if not exists ended_on date;

update public.project_assignments pa
set started_on = coalesce(
  (select min(te.work_date) from public.timesheet_entries te where te.user_id = pa.user_id and te.project_id = pa.project_id),
  current_date
)
where pa.started_on is null;

alter table public.project_assignments alter column started_on set not null;
create index if not exists project_assignments_period_idx on public.project_assignments(user_id, started_on, ended_on);
