alter table public.cleaning_checklist_templates
  add column if not exists cleaning_profile_id uuid references public.property_cleaning_profiles(id);

create index if not exists cleaning_checklist_templates_profile_idx
  on public.cleaning_checklist_templates(property_id, cleaning_profile_id, active);

notify pgrst, 'reload schema';