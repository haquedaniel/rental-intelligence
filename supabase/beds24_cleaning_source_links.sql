create table if not exists public.property_source_links (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    source_system text not null,
    source_property_id text not null,
    source_room_id text not null default '',
    source_listing_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_system, source_property_id, source_room_id)
);

create unique index if not exists reservations_unique_source_booking
on public.reservations(property_id, source_system, source_booking_id);

insert into public.properties (id, name, address)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'La Peskerezh',
    'La Peskerezh'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Voilerie 2 · Un jardin sur la mer',
    'Le Clos de la Voilerie'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'Voilerie 4 · Un balcon sur la mer',
    'Le Clos de la Voilerie'
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    'Voilerie 5 · Le Refuge sous les Toits',
    'Le Clos de la Voilerie'
  )
on conflict (id)
do update set
  name = excluded.name,
  address = excluded.address;

insert into public.property_source_links
(property_id, source_system, source_property_id, source_room_id, source_listing_id)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'beds24',
    '330389',
    '685219',
    'peskerezh'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'beds24',
    '331524',
    '689472',
    'apt2'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'beds24',
    '331524',
    '687189',
    'apt4'
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    'beds24',
    '331524',
    '687116',
    'apt5'
  )
on conflict (source_system, source_property_id, source_room_id)
do update set
  property_id = excluded.property_id,
  source_listing_id = excluded.source_listing_id,
  active = true,
  updated_at = now();

grant select, insert, update, delete on public.property_source_links to service_role;
grant select, insert, update, delete on public.reservations to service_role;
grant select, insert, update, delete on public.properties to service_role;

notify pgrst, 'reload schema';
