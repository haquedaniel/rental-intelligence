-- Automatic, validated channel publication for Pilotys pricing.
alter table public.pricing_publication_actions
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists effective_price_before numeric(10,2),
  add column if not exists effective_price_after numeric(10,2),
  add column if not exists validation_status text,
  add column if not exists last_attempt_at timestamptz;

create index if not exists pricing_publication_actions_retry_idx
  on public.pricing_publication_actions(status, next_attempt_at, created_at)
  where status in ('proposed','failed');

alter table public.pricing_property_settings
  add column if not exists publication_paused boolean not null default false,
  add column if not exists publication_last_run_at timestamptz,
  add column if not exists publication_last_success_at timestamptz,
  add column if not exists publication_last_error text;
