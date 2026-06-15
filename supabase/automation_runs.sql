create table if not exists public.automation_runs (
    id uuid primary key default gen_random_uuid(),
    job_name text not null,
    status text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    duration_seconds numeric,
    summary jsonb not null default '{}'::jsonb,
    log_tail text,
    error_message text,
    created_at timestamptz not null default now()
);

grant select, insert, update on public.automation_runs to service_role;

notify pgrst, 'reload schema';
