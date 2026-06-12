-- supabase/schema_mvp_cleaning.sql

create extension if not exists "uuid-ossp";

-- Owners / clients
create table if not exists owners (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    email text,
    created_at timestamptz not null default now()
);

-- Properties
create table if not exists properties (
    id uuid primary key default uuid_generate_v4(),
    owner_id uuid references owners(id) on delete cascade,

    name text not null,
    address text,
    status text not null default 'active',

    preferred_cleaner_id uuid,
    created_at timestamptz not null default now()
);

-- Cleaners
create table if not exists cleaners (
    id uuid primary key default uuid_generate_v4(),

    first_name text not null,
    last_name text,
    phone text,
    email text,

    status text not null default 'active',

    home_location_label text,
    home_lat numeric,
    home_lng numeric,

    hourly_rate_eur numeric not null default 0,
    included_radius_km numeric not null default 0,
    travel_rate_per_km_eur numeric not null default 0,

    payment_method text,
    payment_details text,

    worker_type text not null default 'individual',
    legal_name text,
    trading_name text,
    siret text,
    billing_address text,
    vat_status text,
    invoice_note text,

    created_at timestamptz not null default now()
);

alter table properties
add constraint properties_preferred_cleaner_fk
foreign key (preferred_cleaner_id) references cleaners(id);

-- Property-specific cleaning profiles
create table if not exists property_cleaning_profiles (
    id uuid primary key default uuid_generate_v4(),

    property_id uuid not null references properties(id) on delete cascade,

    code text not null,
    label text not null,
    estimated_hours numeric not null,
    description text,
    is_default boolean not null default false,

    created_at timestamptz not null default now(),

    unique(property_id, code)
);

-- Reservations imported from Beds24 or created manually
create table if not exists reservations (
    id uuid primary key default uuid_generate_v4(),

    property_id uuid not null references properties(id) on delete cascade,

    source_system text,
    source_booking_id text,

    guest_name text,
    checkin_at timestamptz,
    checkout_at timestamptz not null,
    next_checkin_at timestamptz,

    number_of_guests integer not null default 1,
    nights integer,

    status text not null default 'confirmed',

    linen_required boolean not null default true,
    laundry_required boolean not null default true,

    created_at timestamptz not null default now()
);

-- Cleaning requests / missions
create table if not exists cleaning_requests (
    id uuid primary key default uuid_generate_v4(),

    property_id uuid not null references properties(id) on delete cascade,
    reservation_id uuid references reservations(id) on delete set null,
    cleaning_profile_id uuid not null references property_cleaning_profiles(id),

    assigned_cleaner_id uuid references cleaners(id),

    scheduled_start_at timestamptz not null,
    scheduled_end_at timestamptz not null,

    status text not null default 'created',

    urgent boolean not null default false,
    response_deadline_at timestamptz,

    number_of_guests integer not null default 1,
    linen_required boolean not null default true,
    laundry_required boolean not null default true,

    estimated_hours numeric not null,
    cleaning_cost_eur numeric not null default 0,
    travel_distance_km numeric not null default 0,
    billable_travel_km numeric not null default 0,
    travel_cost_eur numeric not null default 0,
    urgency_bonus_percent numeric not null default 0,
    urgency_bonus_eur numeric not null default 0,
    total_cost_eur numeric not null default 0,

    refusal_reason text,
    accepted_at timestamptz,
    refused_at timestamptz,

    created_at timestamptz not null default now()
);

-- Temporary cleaner unavailability
create table if not exists cleaner_unavailability (
    id uuid primary key default uuid_generate_v4(),

    cleaner_id uuid not null references cleaners(id) on delete cascade,

    start_at timestamptz not null,
    end_at timestamptz not null,
    reason text,

    created_at timestamptz not null default now()
);

-- Cleaning reports, later with photos
create table if not exists cleaning_reports (
    id uuid primary key default uuid_generate_v4(),

    cleaning_request_id uuid not null references cleaning_requests(id) on delete cascade,
    cleaner_id uuid not null references cleaners(id),

    ready_for_guest boolean not null default false,
    problem_reported boolean not null default false,
    comments text,

    submitted_at timestamptz not null default now()
);

-- Uploaded report photos metadata
create table if not exists cleaning_report_photos (
    id uuid primary key default uuid_generate_v4(),

    cleaning_report_id uuid not null references cleaning_reports(id) on delete cascade,

    photo_label text,
    storage_path text not null,

    taken_at timestamptz,
    uploaded_at timestamptz not null default now(),

    gps_lat numeric,
    gps_lng numeric
);