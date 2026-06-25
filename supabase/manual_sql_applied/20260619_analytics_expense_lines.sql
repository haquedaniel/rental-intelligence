
create table if not exists public.analytics_expense_lines (
  row_key text primary key,
  client_id text,
  portfolio_id text not null,
  portfolio_name text,
  listing_id text not null,
  listing_name text,
  property_id uuid references public.properties(id) on delete set null,
  source_booking_id text,
  expense_source text not null,
  expense_date date,
  period_start date,
  period_end date,
  year_month text not null,
  rule_id text,
  category text,
  cost_family text,
  calculation_type text,
  occupied_days numeric,
  amount_per_day numeric,
  expense_amount numeric,
  payload jsonb not null default '{}'::jsonb,
  source_file text not null,
  generated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_analytics_expense_lines_property_date
  on public.analytics_expense_lines(property_id, expense_date);

create index if not exists idx_analytics_expense_lines_property_month
  on public.analytics_expense_lines(property_id, year_month);

create index if not exists idx_analytics_expense_lines_portfolio_month
  on public.analytics_expense_lines(portfolio_id, year_month);

create index if not exists idx_analytics_expense_lines_source
  on public.analytics_expense_lines(expense_source, category, cost_family);
