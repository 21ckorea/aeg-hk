create table if not exists public.company_settings (
  id text primary key default 'global' check (id = 'global'),
  name text not null,
  short_name text not null,
  intranet_name text not null,
  contact_email text not null,
  updated_at timestamptz not null default now()
);
