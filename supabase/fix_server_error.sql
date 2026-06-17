alter table public.cleaning_checklist_sections
  add column if not exists sort_order integer not null default 100;

-- Optional safety: if you already had an older ordering column, copy it across.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaning_checklist_sections'
      and column_name = 'display_order'
  ) then
    execute '
      update public.cleaning_checklist_sections
      set sort_order = display_order
      where sort_order = 100 and display_order is not null
    ';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaning_checklist_sections'
      and column_name = 'order_index'
  ) then
    execute '
      update public.cleaning_checklist_sections
      set sort_order = order_index
      where sort_order = 100 and order_index is not null
    ';
  end if;
end $$;

notify pgrst, 'reload schema';