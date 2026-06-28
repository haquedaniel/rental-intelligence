alter table public.property_reference_photos
  add column if not exists original_storage_bucket text,
  add column if not exists original_storage_path text,
  add column if not exists optimized_at timestamptz,
  add column if not exists original_size_bytes integer,
  add column if not exists optimized_size_bytes integer;
