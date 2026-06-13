alter table public.cleaning_report_photos
add column if not exists cleaning_request_id uuid references public.cleaning_requests(id) on delete cascade;

grant select, insert, update, delete on public.cleaning_report_photos to service_role;

notify pgrst, 'reload schema';