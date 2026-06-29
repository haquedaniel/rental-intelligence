alter table public.cleaning_requests
  add column if not exists reference_photo_bucket text,
  add column if not exists reference_photo_path text;
