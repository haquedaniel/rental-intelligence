create table if not exists public.property_reference_photos (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    section_key text,
    title text,
    storage_bucket text not null default 'cleaning-reference-photos',
    storage_path text not null,
    is_cover boolean not null default false,
    display_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists property_reference_photos_property_id_idx
on public.property_reference_photos(property_id);

create index if not exists property_reference_photos_section_key_idx
on public.property_reference_photos(section_key);

insert into storage.buckets (id, name, public)
values ('cleaning-reference-photos', 'cleaning-reference-photos', false)
on conflict (id) do nothing;

grant select, insert, update, delete on public.property_reference_photos to service_role;

notify pgrst, 'reload schema';