alter table public.cleaning_requests
  add column if not exists allow_occupied_intervention boolean not null default false;
