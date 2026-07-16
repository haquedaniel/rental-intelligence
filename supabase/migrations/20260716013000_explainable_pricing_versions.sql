-- Explainable/versioned Pilotys pricing. Safe to apply after the existing pricing migration.
alter table public.pricing_property_settings
  add column if not exists optimisation_curve jsonb not null default '[{"days_before":120,"discount_pct":0},{"days_before":90,"discount_pct":2},{"days_before":60,"discount_pct":6},{"days_before":30,"discount_pct":15},{"days_before":7,"discount_pct":25},{"days_before":0,"discount_pct":30}]'::jsonb,
  add column if not exists market_signal_enabled boolean not null default false,
  add column if not exists market_signal_influence_pct numeric(6,2) not null default 0,
  add column if not exists market_signal_competitor_id text not null default 'le_goyen_hotel';

alter table public.pricing_seasons
  add column if not exists optimisation_curve jsonb,
  add column if not exists protect_from_automatic_reductions boolean not null default false,
  add column if not exists market_signal_influence_pct numeric(6,2);

create table if not exists public.pricing_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  version_number integer not null,
  status text not null default 'active' check (status in ('active','superseded')),
  settings_snapshot jsonb not null,
  seasons_snapshot jsonb not null default '[]'::jsonb,
  change_summary text,
  created_by text,
  rolled_back_from_version_id uuid references public.pricing_configuration_versions(id),
  created_at timestamptz not null default now(),
  unique(property_id, version_number)
);
create unique index if not exists pricing_configuration_versions_one_active
  on public.pricing_configuration_versions(property_id) where status='active';

create table if not exists public.pricing_calendar_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  configuration_version_id uuid not null references public.pricing_configuration_versions(id),
  status text not null default 'active' check (status in ('active','superseded')),
  date_from date not null,
  date_to date not null,
  changed_dates integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists pricing_calendar_versions_one_active
  on public.pricing_calendar_versions(property_id) where status='active';

alter table public.pricing_daily_prices
  add column if not exists configuration_version_id uuid references public.pricing_configuration_versions(id),
  add column if not exists calendar_version_id uuid references public.pricing_calendar_versions(id),
  add column if not exists explanation_steps jsonb not null default '[]'::jsonb,
  add column if not exists market_signal_pct numeric(8,4) not null default 0,
  add column if not exists time_discount_pct numeric(8,4) not null default 0;

create index if not exists pricing_daily_prices_calendar_version_idx
  on public.pricing_daily_prices(calendar_version_id);
