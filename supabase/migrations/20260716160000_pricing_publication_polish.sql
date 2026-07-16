alter table public.pricing_property_settings
  add column if not exists publication_price_increment numeric(10,2) not null default 1.00,
  add column if not exists publication_min_change_eur numeric(10,2) not null default 1.00,
  add column if not exists publication_last_selected integer not null default 0,
  add column if not exists publication_last_applied integer not null default 0,
  add column if not exists publication_last_failed integer not null default 0,
  add column if not exists publication_last_reconciled integer not null default 0,
  add column if not exists publication_initial_sync_completed_at timestamptz;
