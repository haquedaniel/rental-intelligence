alter table public.outbound_messages
  add column if not exists cleaner_id uuid references public.cleaners(id) on delete set null,
  add column if not exists owner_id uuid references public.owners(id) on delete set null,
  add column if not exists is_test boolean not null default false,
  add column if not exists test_scenario_id uuid references public.test_scenarios(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'outbound_messages'
      and column_name = 'cleaning_request_id'
      and is_nullable = 'NO'
  ) then
    alter table public.outbound_messages
      alter column cleaning_request_id drop not null;
  end if;
end $$;

notify pgrst, 'reload schema';