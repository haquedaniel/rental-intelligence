alter table public.cleaning_checklist_sections
add column if not exists active boolean not null default true;

notify pgrst, 'reload schema';
