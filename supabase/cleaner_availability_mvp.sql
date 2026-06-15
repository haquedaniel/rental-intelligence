create table if not exists public.cleaner_weekly_availability (
    id uuid primary key default gen_random_uuid(),
    cleaner_id uuid not null references public.cleaners(id) on delete cascade,
    weekday integer not null check (weekday between 1 and 7),
    available boolean not null default true,
    start_time time,
    end_time time,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (cleaner_id, weekday)
);

create table if not exists public.cleaner_unavailability_periods (
    id uuid primary key default gen_random_uuid(),
    cleaner_id uuid not null references public.cleaners(id) on delete cascade,
    starts_on date not null,
    ends_on date not null,
    reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_on >= starts_on)
);

create index if not exists cleaner_weekly_availability_cleaner_idx
on public.cleaner_weekly_availability(cleaner_id, weekday);

create index if not exists cleaner_unavailability_periods_cleaner_idx
on public.cleaner_unavailability_periods(cleaner_id, starts_on, ends_on);

grant select, insert, update, delete on public.cleaner_weekly_availability to service_role;
grant select, insert, update, delete on public.cleaner_unavailability_periods to service_role;

notify pgrst, 'reload schema';
