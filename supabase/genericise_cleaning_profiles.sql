alter table public.property_cleaning_profiles
  add column if not exists service_type text not null default 'standard_cleaning',
  add column if not exists description text,
  add column if not exists active boolean not null default true,
  add column if not exists default_linen_required boolean not null default true,
  add column if not exists default_laundry_required boolean not null default true,
  add column if not exists sort_order integer not null default 100;

notify pgrst, 'reload schema';