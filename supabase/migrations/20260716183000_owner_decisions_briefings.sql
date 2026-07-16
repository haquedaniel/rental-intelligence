create table if not exists public.ops_decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  category text not null check (category in ('reservation','cleaning','pricing','automation','maintenance')),
  decision_type text not null,
  severity text not null default 'info' check (severity in ('info','attention','important','critical')),
  title text not null,
  summary text not null,
  what_happened text,
  why text,
  action_taken text,
  requires_owner_action boolean not null default false,
  sms_candidate boolean not null default true,
  event_key text not null,
  related_object_type text,
  related_object_id uuid,
  reservation_id uuid references public.reservations(id) on delete set null,
  cleaning_request_id uuid references public.cleaning_requests(id) on delete set null,
  pricing_calendar_version_id uuid references public.pricing_calendar_versions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(event_key)
);
create index if not exists ops_decisions_owner_occurred_idx on public.ops_decisions(owner_id, occurred_at desc);
create index if not exists ops_decisions_property_occurred_idx on public.ops_decisions(property_id, occurred_at desc);

create table if not exists public.ops_briefing_preferences (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'morning' check (frequency in ('immediate','morning','evening','daily','weekly')),
  timezone text not null default 'Europe/Paris',
  delivery_hour integer not null default 8 check (delivery_hour between 0 and 23),
  weekly_day integer not null default 1 check (weekly_day between 0 and 6),
  recipient_1_phone text,
  recipient_2_phone text,
  included_property_ids uuid[],
  include_reservations boolean not null default true,
  include_cleaning_completed boolean not null default true,
  include_cleaner_accepted boolean not null default true,
  include_cleaner_refused boolean not null default true,
  include_cleaning_rescheduled boolean not null default true,
  include_pricing boolean not null default true,
  include_min_stay boolean not null default true,
  pricing_threshold_type text not null default 'pct' check (pricing_threshold_type in ('pct','eur')),
  pricing_threshold_value numeric(10,2) not null default 2,
  include_temporal_daily boolean not null default true,
  last_briefing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_briefings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  frequency text not null,
  title text not null,
  body text not null,
  decision_ids uuid[] not null default '{}',
  decision_count integer not null default 0,
  requires_owner_action boolean not null default false,
  status text not null default 'generated' check (status in ('generated','queued','partially_sent','sent','failed','cancelled')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ops_briefings_owner_generated_idx on public.ops_briefings(owner_id, generated_at desc);

create table if not exists public.ops_briefing_deliveries (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.ops_briefings(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  channel text not null default 'sms',
  recipient text not null,
  outbound_message_id uuid references public.outbound_messages(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(briefing_id, channel, recipient)
);

alter table public.ops_decisions enable row level security;
alter table public.ops_briefing_preferences enable row level security;
alter table public.ops_briefings enable row level security;
alter table public.ops_briefing_deliveries enable row level security;
grant all on public.ops_decisions, public.ops_briefing_preferences, public.ops_briefings, public.ops_briefing_deliveries to service_role;
