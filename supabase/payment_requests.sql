create extension if not exists pgcrypto;

-- Extras are attached to the actual mission/report, not the month-end request.
create table if not exists public.cleaning_request_extras (
  id uuid primary key default gen_random_uuid(),

  cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
  cleaning_report_id uuid references public.cleaning_reports(id) on delete set null,
  cleaner_id uuid references public.cleaners(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,

  amount_eur numeric(10,2) not null default 0,
  reason text not null,
  status text not null default 'pending_owner_review'
    check (status in ('pending_owner_review', 'approved', 'rejected', 'included')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cleaning_request_extras_request_idx
  on public.cleaning_request_extras(cleaning_request_id);

create index if not exists cleaning_request_extras_cleaner_idx
  on public.cleaning_request_extras(cleaner_id, created_at);


-- Monthly request issued by the cleaner.
create table if not exists public.monthly_payment_requests (
  id uuid primary key default gen_random_uuid(),

  cleaner_id uuid not null references public.cleaners(id) on delete cascade,

  period_start date not null,
  period_end date not null,

  status text not null default 'draft'
    check (status in ('draft', 'sent_to_owner', 'paid', 'overdue', 'cancelled')),

  public_token text not null default replace(gen_random_uuid()::text, '-', ''),

  total_base_eur numeric(10,2) not null default 0,
  total_extras_eur numeric(10,2) not null default 0,
  total_eur numeric(10,2) not null default 0,

  cleaner_message text,

  owner_recipient_name text,
  owner_recipient_phone text,
  owner_recipient_email text,

  payment_method_snapshot text,
  payment_details_snapshot text,
  iban_snapshot text,

  invoice_status text not null default 'not_required'
    check (invoice_status in ('not_required', 'draft_needed', 'attached', 'sent')),
  invoice_number text,
  invoice_pdf_path text,

  sent_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(cleaner_id, period_start, period_end)
);

create unique index if not exists monthly_payment_requests_public_token_idx
  on public.monthly_payment_requests(public_token);


create table if not exists public.monthly_payment_request_lines (
  id uuid primary key default gen_random_uuid(),

  monthly_payment_request_id uuid not null references public.monthly_payment_requests(id) on delete cascade,

  cleaning_request_id uuid references public.cleaning_requests(id) on delete set null,
  cleaning_report_id uuid references public.cleaning_reports(id) on delete set null,
  extra_id uuid references public.cleaning_request_extras(id) on delete set null,

  line_type text not null default 'mission'
    check (line_type in ('mission', 'extra')),

  work_date date not null,
  property_id uuid references public.properties(id) on delete set null,
  property_name text,

  service_type text,
  description text not null,

  hours numeric(8,2) not null default 0,
  amount_eur numeric(10,2) not null default 0,

  status text not null default 'included'
    check (status in ('included', 'pending_owner_review', 'excluded', 'disputed')),

  created_at timestamptz not null default now()
);

create index if not exists monthly_payment_request_lines_request_idx
  on public.monthly_payment_request_lines(monthly_payment_request_id);

create index if not exists monthly_payment_request_lines_cleaning_request_idx
  on public.monthly_payment_request_lines(cleaning_request_id);


-- Outbound messages can also relate to a monthly payment request.
alter table public.outbound_messages
  add column if not exists monthly_payment_request_id uuid references public.monthly_payment_requests(id) on delete set null;

-- Only do this if cleaning_request_id is currently NOT NULL.
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