alter table public.cleaning_report_photos
    add column if not exists section_key text,
    add column if not exists photo_type text not null default 'proof',
    add column if not exists storage_bucket text,
    add column if not exists storage_path text,
    add column if not exists original_filename text,
    add column if not exists content_type text,
    add column if not exists size_bytes bigint,
    add column if not exists caption text,
    add column if not exists uploaded_at timestamptz not null default now();

grant select, insert, update, delete on public.cleaning_report_photos to service_role;

notify pgrst, 'reload schema';