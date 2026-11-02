-- Urban Blueprint: shared maps (/maps/<id>). Run in Supabase → SQL Editor. Safe to run again.
--
-- The site uses only the public (publishable/anon) key and needs exactly three operations:
--   create a map, read a map by id, update a map by id ("share with a link" = anyone with the link may edit).
-- Everything else is denied: no delete, no writing id/created_at, bounded title and data size.
-- Note: like before, the public key can read every row of this table; map ids are random UUIDs.

create extension if not exists pgcrypto;

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Limits: the editor's MapState is an object with these arrays; a large real map is ~40 KB.
alter table public.maps drop constraint if exists maps_title_length;
alter table public.maps add constraint maps_title_length check (char_length(title) <= 200);
alter table public.maps drop constraint if exists maps_data_shape;
alter table public.maps add constraint maps_data_shape check (
  jsonb_typeof(data) = 'object' and data ?& array['zones', 'roads', 'buildings', 'gates']
);
alter table public.maps drop constraint if exists maps_data_size;
alter table public.maps add constraint maps_data_size check (octet_length(data::text) <= 2097152);

-- updated_at is set by the server, whatever the client sends.
create or replace function public.maps_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists maps_touch_updated_at on public.maps;
create trigger maps_touch_updated_at
before update on public.maps
for each row execute function public.maps_touch_updated_at();

-- Privileges: only the columns the site reads and writes.
alter table public.maps enable row level security;
revoke all on table public.maps from anon, authenticated;
grant select (id, title, data, created_at, updated_at) on table public.maps to anon, authenticated;
grant insert (title, data) on table public.maps to anon, authenticated;
grant update (title, data, updated_at) on table public.maps to anon, authenticated;

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

-- No delete policy and no delete privilege: maps cannot be deleted with the public key.
