alter table public.property_cleaner_assignments
    add column if not exists travel_distance_km numeric;

notify pgrst, 'reload schema';
