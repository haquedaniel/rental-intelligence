alter table public.properties
    add column if not exists preferred_cleaner_id uuid references public.cleaners(id) on delete set null;

create table if not exists public.property_cleaner_assignments (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    cleaner_id uuid not null references public.cleaners(id) on delete cascade,
    role text not null check (role in ('primary', 'backup')),
    priority integer not null default 1,
    familiar boolean not null default false,
    active boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (property_id, cleaner_id)
);

create unique index if not exists property_cleaner_assignments_one_primary
on public.property_cleaner_assignments(property_id)
where role = 'primary' and active = true;

create index if not exists property_cleaner_assignments_property_idx
on public.property_cleaner_assignments(property_id, active, role, priority);

grant select, insert, update, delete on public.properties to service_role;
grant select, insert, update, delete on public.property_cleaner_assignments to service_role;

notify pgrst, 'reload schema';
