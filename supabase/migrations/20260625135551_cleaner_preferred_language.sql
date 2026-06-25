alter table public.cleaners
  add column if not exists preferred_language text not null default 'fr';

alter table public.cleaners
  drop constraint if exists cleaners_preferred_language_check;

alter table public.cleaners
  add constraint cleaners_preferred_language_check
  check (preferred_language in ('fr', 'en', 'ru'));
