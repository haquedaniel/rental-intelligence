-- Pilotys owner cockpit token route
-- Adds a private-link token to owners for routes like /owner/<public_token>/cockpit.

alter table public.owners
  add column if not exists public_token text;

create unique index if not exists owners_public_token_unique_idx
  on public.owners(public_token)
  where public_token is not null;

-- Backfill existing owners. Uses pgcrypto, already commonly available on Supabase.
create extension if not exists pgcrypto;

update public.owners
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table public.owners
  alter column public_token set not null;
