create table if not exists public.property_listing_photos (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    caption text not null default '',
    category text not null default 'other',
    storage_bucket text not null default 'property-listing-photos',
    storage_path text not null,
    sort_order integer not null default 100,
    is_active boolean not null default true,
    airbnb_enabled boolean not null default true,
    vrbo_enabled boolean not null default true,
    booking_enabled boolean not null default true,
    direct_enabled boolean not null default true,
    sync_status text not null default 'draft'
        check (sync_status in ('draft', 'ready', 'blocked_api', 'synced', 'error')),
    sync_error text,
    last_sync_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists property_listing_photos_property_id_idx
on public.property_listing_photos(property_id);

create index if not exists property_listing_photos_property_order_idx
on public.property_listing_photos(property_id, sort_order)
where is_active = true;

insert into storage.buckets (id, name, public)
values ('property-listing-photos', 'property-listing-photos', true)
on conflict (id) do update set public = excluded.public;

grant select, insert, update, delete on public.property_listing_photos to service_role;

notify pgrst, 'reload schema';
