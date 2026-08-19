-- Smart Hospital Queue database
create table if not exists public.queue_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  phone text not null,
  department text not null,
  token_number integer not null,
  status text not null default 'waiting'
    check (status in ('waiting','serving','completed')),
  created_at timestamptz not null default now()
);

alter table public.queue_tokens enable row level security;

-- Demo policies for the first deployment.
-- Tighten these policies before using the app with real patient data.
create policy "public can read queue"
on public.queue_tokens for select
to anon, authenticated
using (true);

create policy "public can create queue token"
on public.queue_tokens for insert
to anon, authenticated
with check (true);

create policy "public can update queue"
on public.queue_tokens for update
to anon, authenticated
using (true)
with check (true);