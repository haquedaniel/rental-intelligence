
alter table public.cleaners
    add column if not exists email text,
    add column if not exists active boolean not null default true,
    add column if not exists notes text,
    add column if not exists updated_at timestamptz not null default now();

alter table public.properties
    add column if not exists preferred_cleaner_id uuid references public.cleaners(id) on delete set null;

grant select, insert, update, delete on public.cleaners to service_role;
grant select, insert, update, delete on public.properties to service_role;

notify pgrst, 'reload schema';
