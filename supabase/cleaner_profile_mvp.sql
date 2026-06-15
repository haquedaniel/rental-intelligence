alter table public.cleaners
    add column if not exists profile_photo_bucket text,
    add column if not exists profile_photo_path text,
    add column if not exists email text,
    add column if not exists address text,
    add column if not exists latitude numeric,
    add column if not exists longitude numeric,
    add column if not exists status text not null default 'active',
    add column if not exists services jsonb not null default '[]'::jsonb,
    add column if not exists hourly_rate_eur numeric not null default 18,
    add column if not exists included_radius_km numeric not null default 0,
    add column if not exists travel_rate_per_km_eur numeric not null default 0,
    add column if not exists urgency_bonus_percent numeric not null default 15,
    add column if not exists preferred_towns text,
    add column if not exists max_travel_distance_km numeric,
    add column if not exists payment_method text,
    add column if not exists payment_details text,
    add column if not exists internal_rating integer,
    add column if not exists quality_notes text,
    add column if not exists worker_type text not null default 'individual_payment_request',
    add column if not exists legal_name text,
    add column if not exists trading_name text,
    add column if not exists siret text,
    add column if not exists business_address text,
    add column if not exists billing_email text,
    add column if not exists vat_status text,
    add column if not exists invoice_note text,
    add column if not exists payment_terms text,
    add column if not exists iban text,
    add column if not exists notes text,
    add column if not exists active boolean not null default true,
    add column if not exists updated_at timestamptz not null default now();

insert into storage.buckets (id, name, public)
values ('cleaner-profile-photos', 'cleaner-profile-photos', false)
on conflict (id) do nothing;

grant select, insert, update, delete on public.cleaners to service_role;

notify pgrst, 'reload schema';