create extension if not exists pgcrypto;

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.maps enable row level security;

drop policy if exists "Public read maps" on public.maps;
create policy "Public read maps"
on public.maps
for select
to anon, authenticated
using (true);

drop policy if exists "Public insert maps" on public.maps;
create policy "Public insert maps"
on public.maps
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public update maps" on public.maps;
create policy "Public update maps"
on public.maps
for update
to anon, authenticated
using (true)
with check (true);
