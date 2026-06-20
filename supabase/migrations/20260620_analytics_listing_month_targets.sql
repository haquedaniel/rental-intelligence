create table if not exists public.analytics_listing_month_targets (
  row_key text primary key,
  client_id text not null,
  portfolio_id text,
  portfolio_name text,
  listing_id text not null,
  listing_name text,
  property_id uuid references public.properties(id) on delete set null,
  year_month text not null,
  target_gross_booking_value numeric,
  target_host_payout numeric,
  target_after_variables numeric,
  target_after_fixes numeric,
  occupancy_target_pct numeric,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_listing_month_targets_property_month
  on public.analytics_listing_month_targets(property_id, year_month);

create index if not exists idx_analytics_listing_month_targets_listing_month
  on public.analytics_listing_month_targets(listing_id, year_month);

create index if not exists idx_analytics_listing_month_targets_portfolio_month
  on public.analytics_listing_month_targets(portfolio_id, year_month);

notify pgrst, 'reload schema';
