-- Make sure outbound messages can be payment-related, not only mission-related.

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

alter table public.outbound_messages
  add column if not exists owner_id uuid references public.owners(id) on delete set null,
  add column if not exists monthly_payment_request_id uuid references public.monthly_payment_requests(id) on delete set null;

notify pgrst, 'reload schema';