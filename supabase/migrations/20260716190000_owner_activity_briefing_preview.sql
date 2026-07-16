create table if not exists public.ops_briefing_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  requested_by text,
  lookback_hours integer not null default 24 check (lookback_hours between 1 and 168),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','cancelled')),
  briefing_id uuid references public.ops_briefings(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists ops_briefing_requests_pending_idx
  on public.ops_briefing_requests(status, created_at);

alter table public.ops_briefing_requests enable row level security;
grant all on public.ops_briefing_requests to service_role;
