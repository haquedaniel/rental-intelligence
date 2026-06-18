create extension if not exists pgcrypto;

create table if not exists public.test_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scenario_type text not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.reservations
  add column if not exists test_scenario_id uuid references public.test_scenarios(id) on delete cascade;

alter table public.cleaning_requests
  add column if not exists test_scenario_id uuid references public.test_scenarios(id) on delete cascade,
  add column if not exists work_window_start_at timestamptz,
  add column if not exists work_window_end_at timestamptz,
  add column if not exists ready_by_at timestamptz,
  add column if not exists ready_by_date date,
  add column if not exists schedule_status text not null default 'waiting_for_ready_day',
  add column if not exists planning_changed_at timestamptz,
  add column if not exists ready_notification_sent_at timestamptz,
  add column if not exists assignment_reason text;

create table if not exists public.cleaning_request_ready_day_options (
  id uuid primary key default gen_random_uuid(),

  cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
  cleaner_id uuid references public.cleaners(id) on delete set null,

  ready_by_date date not null,
  ready_by_at timestamptz not null,
  label text not null,

  is_available boolean not null default true,
  disabled_reason text,
  selected_at timestamptz,

  test_scenario_id uuid references public.test_scenarios(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique(cleaning_request_id, cleaner_id, ready_by_date)
);

create index if not exists ready_day_options_request_idx
  on public.cleaning_request_ready_day_options(cleaning_request_id);

alter table public.outbound_messages
  add column if not exists is_test boolean not null default false,
  add column if not exists test_scenario_id uuid references public.test_scenarios(id) on delete cascade;

notify pgrst, 'reload schema';