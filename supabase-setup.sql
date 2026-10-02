-- =====================================================================
-- West-Coast AI CRM — Supabase setup (sirf EK BAAR chalana hai)
-- Supabase Dashboard > SQL Editor > New query > ye poora paste > RUN
-- =====================================================================

-- 1) Contacts (har card ek row)
create table if not exists public.wc_contacts (
  record_id  text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) Activity log
create table if not exists public.wc_activity (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  by_user text,
  msg     text
);
create index if not exists wc_activity_at_idx on public.wc_activity (at desc);

-- 3) Settings (employees list + passwords)
create table if not exists public.wc_settings (
  key   text primary key,
  value jsonb
);

-- 4) Security: browser se direct access band, sirf server (service role) access karega
alter table public.wc_contacts enable row level security;
alter table public.wc_activity enable row level security;
alter table public.wc_settings enable row level security;

-- 5) Card photos ke liye private storage bucket
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;
