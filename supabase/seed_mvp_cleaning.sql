-- supabase/seed_mvp_cleaning.sql

insert into owners (id, name, email)
values
('00000000-0000-0000-0000-000000000001', 'Daniel & Aurore', 'dhaque@gmail.com')
on conflict do nothing;

insert into cleaners (
    id,
    first_name,
    last_name,
    phone,
    hourly_rate_eur,
    home_location_label,
    included_radius_km,
    travel_rate_per_km_eur,
    payment_method,
    worker_type
)
values
(
    '10000000-0000-0000-0000-000000000001',
    'Marie',
    'Test',
    '+33600000000',
    16,
    'Pont-Croix',
    10,
    0.50,
    'IBAN',
    'individual'
),
(
    '10000000-0000-0000-0000-000000000002',
    'Sophie',
    'Test',
    '+33611111111',
    18,
    'Douarnenez',
    8,
    0.60,
    'Payment link',
    'auto_entrepreneur'
)
on conflict do nothing;

insert into properties (
    id,
    owner_id,
    name,
    address,
    preferred_cleaner_id
)
values
(
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'La Peskerezh',
    'Plouhinec',
    '10000000-0000-0000-0000-000000000001'
)
on conflict do nothing;

insert into property_cleaning_profiles (
    id,
    property_id,
    code,
    label,
    estimated_hours,
    description,
    is_default
)
values
(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'light',
    'Ménage léger',
    2.0,
    'Séjour court / faible occupation / remise en état simple',
    false
),
(
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'standard',
    'Ménage standard',
    3.0,
    'Ménage complet entre deux séjours',
    true
),
(
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'deep_windows',
    'Ménage approfondi - vitres',
    4.0,
    'Ménage standard + focus vitres',
    false
)
on conflict do nothing;

insert into reservations (
    id,
    property_id,
    source_system,
    source_booking_id,
    guest_name,
    checkin_at,
    checkout_at,
    next_checkin_at,
    number_of_guests,
    nights,
    linen_required,
    laundry_required
)
values
(
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'manual',
    'demo-res-001',
    'Client test',
    '2026-07-08 16:00:00+00',
    '2026-07-10 10:00:00+00',
    '2026-07-11 16:00:00+00',
    2,
    2,
    true,
    true
)
on conflict do nothing;