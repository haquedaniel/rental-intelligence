create table if not exists public.reservation_financials (
  id uuid primary key default gen_random_uuid(),

  source_system text not null,
  source_booking_id text not null,

  client_id text,
  portfolio_id text,
  portfolio_name text,
  property_key text,
  property_name text,
  listing_name text,
  booking_channel text,
  reservation_status text,

  checkin_date date,
  checkout_date date,
  nights integer,
  number_of_guests integer,

  gross_booking_value_eur numeric,
  accommodation_revenue_eur numeric,
  host_payout_eur numeric,
  cleaning_fee_charged_eur numeric,
  adr_eur numeric,

  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_system, source_booking_id)
);

create index if not exists reservation_financials_booking_idx
  on public.reservation_financials(source_system, source_booking_id);