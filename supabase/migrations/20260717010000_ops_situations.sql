create table if not exists public.ops_situations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  situation_key text not null unique,
  situation_type text not null,
  status text not null default 'active'
    check (status in ('active','resolved','monitoring','dismissed')),
  priority text not null default 'info'
    check (priority in ('info','attention','important','critical')),
  headline text not null,
  situation_text text not null,
  explanation_text text,
  action_text text,
  next_step_text text,
  requires_owner_action boolean not null default false,
  source_decision_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_situations_owner_last_observed_idx
  on public.ops_situations(owner_id, last_observed_at desc);

create index if not exists ops_situations_property_last_observed_idx
  on public.ops_situations(property_id, last_observed_at desc);

create index if not exists ops_situations_owner_status_idx
  on public.ops_situations(owner_id, status, priority);

alter table public.ops_situations enable row level security;
grant all on public.ops_situations to service_role;
