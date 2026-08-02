alter table public.notices
  add column if not exists popup_enabled boolean not null default false,
  add column if not exists popup_start date,
  add column if not exists popup_end date;

alter table public.notices
  drop constraint if exists notices_popup_period_check;

alter table public.notices
  add constraint notices_popup_period_check check (
    (popup_enabled = false and popup_start is null and popup_end is null)
    or (popup_enabled = true and popup_start is not null and popup_end is not null and popup_start <= popup_end)
  );
