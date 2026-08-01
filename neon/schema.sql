-- Run once in the Neon SQL Editor after creating the database through Vercel.
-- DATABASE_URL stays on the Vercel server and is never sent to the browser.
create table if not exists public.intranet_app_state (
  id text primary key check (id = 'global'),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
