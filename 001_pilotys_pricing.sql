-- Pilotys-owned revenue management schema
create table if not exists public.pricing_property_settings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'shadow' check (mode in ('shadow','apply')),
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Paris',
  default_price numeric(10,2) not null default 100,
  default_weekend_price numeric(10,2),
  floor_price numeric(10,2) not null default 50,
  ceiling_price numeric(10,2),
  default_min_stay integer not null default 2 check (default_min_stay >= 1),
  weekly_decay_amount numeric(10,2) not null default 2,
  weekly_decay_max_steps integer not null default 5 check (weekly_decay_max_steps >= 0),
  decay_starts_days_before_arrival integer not null default 120,
  one_night_gap_multiplier numeric(8,4) not null default 1.5,
  one_night_release_days integer not null default 21,
  protect_weekends boolean not null default true,
  planning_horizon_days integer not null default 540,
  strategy_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pricing_seasons (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  weekday_price numeric(10,2) not null,
  weekend_price numeric(10,2),
  floor_price numeric(10,2),
  ceiling_price numeric(10,2),
  min_stay integer not null default 2 check (min_stay >= 1),
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists pricing_seasons_property_dates_idx on public.pricing_seasons(property_id,start_date,end_date) where active;

create table if not exists public.pricing_date_overrides (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  price numeric(10,2),
  min_stay integer check (min_stay is null or min_stay >= 1),
  floor_price numeric(10,2),
  ceiling_price numeric(10,2),
  hold_until timestamptz,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.pricing_daily_prices (
  property_id uuid not null references public.properties(id) on delete cascade,
  date date not null,
  available boolean not null default true,
  occupied boolean not null default false,
  base_price numeric(10,2) not null,
  strategy_adjustment numeric(10,2) not null default 0,
  final_price numeric(10,2) not null,
  floor_price numeric(10,2) not null,
  ceiling_price numeric(10,2),
  min_stay integer not null default 2,
  strategy text not null default 'base_plan',
  decay_step integer not null default 0,
  gap_length integer,
  source_season_id uuid references public.pricing_seasons(id) on delete set null,
  reason_codes text[] not null default '{}',
  calculation jsonb not null default '{}'::jsonb,
  generation_id uuid not null,
  calculated_at timestamptz not null default now(),
  published_price numeric(10,2),
  published_min_stay integer,
  published_at timestamptz,
  publication_status text not null default 'pending' check (publication_status in ('pending','published','failed','not_required')),
  primary key(property_id,date)
);
create index if not exists pricing_daily_prices_date_idx on public.pricing_daily_prices(date);
create index if not exists pricing_daily_prices_pending_idx on public.pricing_daily_prices(property_id,date) where publication_status in ('pending','failed');

create table if not exists public.pricing_actions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  date date not null,
  action_type text not null,
  status text not null default 'proposed' check (status in ('proposed','applying','applied','validation_failed','failed','cancelled','superseded')),
  mode text not null default 'shadow' check (mode in ('shadow','apply')),
  old_price numeric(10,2),
  target_price numeric(10,2),
  old_min_stay integer,
  target_min_stay integer,
  reason_codes text[] not null default '{}',
  reason text,
  generation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  response jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);
create unique index if not exists pricing_actions_open_unique on public.pricing_actions(property_id,date,action_type) where status in ('proposed','applying');

alter table public.pricing_property_settings enable row level security;
alter table public.pricing_seasons enable row level security;
alter table public.pricing_date_overrides enable row level security;
alter table public.pricing_daily_prices enable row level security;
alter table public.pricing_actions enable row level security;
grant all on table public.pricing_property_settings, public.pricing_seasons, public.pricing_date_overrides, public.pricing_daily_prices, public.pricing_actions to service_role;
