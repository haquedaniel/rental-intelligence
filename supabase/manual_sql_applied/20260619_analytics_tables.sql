
-- Analytics tables fed from outputs/processed/*.csv.
-- Operational tables remain untouched.
-- property_id is resolved through public.property_source_links where possible.

create table if not exists public.analytics_daily_calendar (
  row_key text primary key,
  client_id text not null,
  portfolio_id text not null,
  portfolio_name text,
  listing_id text not null,
  listing_name text,
  property_id uuid references public.properties(id) on delete set null,
  source_system text,
  source_property_id text,
  source_room_id text,
  source_booking_id text,
  date date not null,
  year_month text not null,
  status text,
  channel text,
  is_booked boolean,
  num_adult numeric,
  num_child numeric,
  gross_booking_value_allocated numeric,
  accommodation_revenue_allocated numeric,
  cleaning_fee_allocated numeric,
  tourist_tax_allocated numeric,
  channel_commission_allocated numeric,
  host_payout_allocated numeric,
  host_payout_minus_cleaning_allocated numeric,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_daily_calendar_property_date
  on public.analytics_daily_calendar(property_id, date);

create index if not exists idx_analytics_daily_calendar_portfolio_date
  on public.analytics_daily_calendar(portfolio_id, date);


create table if not exists public.analytics_listing_month_financials (
  row_key text primary key,
  client_id text not null,
  portfolio_id text not null,
  portfolio_name text,
  listing_id text not null,
  listing_name text,
  property_id uuid references public.properties(id) on delete set null,
  year integer not null,
  month integer not null,
  year_month text not null,
  booked_nights numeric,
  available_nights numeric,
  occupancy_pct numeric,
  adr_accommodation numeric,
  gross_booking_value numeric,
  accommodation_revenue numeric,
  cleaning_fee_charged numeric,
  tourist_tax numeric,
  channel_commission numeric,
  host_payout numeric,
  host_payout_minus_cleaning numeric,
  actual_cleaning_cost numeric,
  cleaning_margin numeric,
  concierge_fee numeric,
  other_booking_costs numeric,
  booking_associated_costs_total numeric,
  booking_contribution numeric,
  energy_usage_cost numeric,
  water_usage_cost numeric,
  variable_period_costs_total numeric,
  rental_contribution numeric,
  attributable_fixed_costs_total numeric,
  attributed_profit numeric,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_listing_month_financials_property_month
  on public.analytics_listing_month_financials(property_id, year_month);

create index if not exists idx_analytics_listing_month_financials_portfolio_month
  on public.analytics_listing_month_financials(portfolio_id, year_month);


create table if not exists public.analytics_dashboard_kpis (
  row_key text primary key,
  client_id text not null,
  portfolio_id text not null,
  year integer not null,
  current_month text,
  current_month_host_payout numeric,
  current_month_target_host_payout numeric,
  current_month_vs_target numeric,
  current_month_target_pct numeric,
  current_month_operating_profit numeric,
  current_month_portfolio_cash_result numeric,
  ytd_host_payout numeric,
  target_host_payout numeric,
  host_payout_target_pct numeric,
  host_payout_remaining_to_target numeric,
  host_payout_required_per_remaining_month numeric,
  ytd_operating_profit numeric,
  ytd_portfolio_cash_result numeric,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_dashboard_kpis_portfolio_year
  on public.analytics_dashboard_kpis(portfolio_id, year);


create table if not exists public.analytics_market_benchmark_windows (
  row_key text primary key,
  run_id text,
  retrieved_at timestamptz,
  portfolio_id text,
  market_set_id text,
  listing_id text,
  property_id uuid references public.properties(id) on delete set null,
  scenario_id text,
  check_in date,
  check_out date,
  nights integer,
  adults integer,
  children integer,
  status text,
  bookable boolean,
  own_total_amount numeric,
  own_nightly_amount numeric,
  competitors_checked integer,
  competitors_available integer,
  competitors_unavailable integer,
  competitors_failed integer,
  competitors_usable integer,
  market_availability_rate numeric,
  market_unavailable_rate numeric,
  market_tension text,
  competitor_adjusted_median_nightly numeric,
  competitor_adjusted_p25_nightly numeric,
  competitor_adjusted_p75_nightly numeric,
  own_vs_adjusted_market_pct numeric,
  price_position text,
  pricing_guidance text,
  warning text,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_market_benchmark_property_dates
  on public.analytics_market_benchmark_windows(property_id, check_in, check_out);

create index if not exists idx_analytics_market_benchmark_portfolio_dates
  on public.analytics_market_benchmark_windows(portfolio_id, check_in, check_out);


create table if not exists public.analytics_data_quality_issues (
  row_key text primary key,
  severity text,
  category text,
  issue text,
  details text,
  affected_count integer,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_data_quality_issues_severity
  on public.analytics_data_quality_issues(severity, category);
