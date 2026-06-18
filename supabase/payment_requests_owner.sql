create extension if not exists pgcrypto;

-- 1. Use the existing public.owners table as the owner/payment-recipient table.

alter table public.owners
  add column if not exists display_name text,
  add column if not exists legal_name text,
  add column if not exists billing_email text,
  add column if not exists phone text,
  add column if not exists billing_address text,
  add column if not exists siren text,
  add column if not exists siret text,
  add column if not exists vat_number text,
  add column if not exists vat_status text,
  add column if not exists e_invoicing_platform text,
  add column if not exists payment_request_channel text not null default 'sms',
  add column if not exists payment_due_days integer not null default 5,
  add column if not exists active boolean not null default true,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- If your existing owners table has a "name" column, copy it into display_name.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owners'
      and column_name = 'name'
  ) then
    execute '
      update public.owners
      set display_name = coalesce(display_name, name, legal_name, id::text)
      where display_name is null
    ';
  else
    update public.owners
    set display_name = coalesce(display_name, legal_name, id::text)
    where display_name is null;
  end if;
end $$;

-- 2. Seed Daniel & Aurore inside the existing owners table.
do $$
declare
  default_owner_id uuid;
  has_name_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owners'
      and column_name = 'name'
  )
  into has_name_column;

  select id
  into default_owner_id
  from public.owners
  where display_name = 'Daniel & Aurore'
     or billing_email = 'dhaque@gmail.com'
  limit 1;

  if default_owner_id is null then
    if has_name_column then
      execute $sql$
        insert into public.owners (
          id,
          name,
          display_name,
          legal_name,
          billing_email,
          payment_request_channel,
          payment_due_days,
          active
        )
        values (
          gen_random_uuid(),
          'Daniel & Aurore',
          'Daniel & Aurore',
          'Daniel Haque et Aurore Fourrier',
          'dhaque@gmail.com',
          'sms',
          5,
          true
        )
        returning id
      $sql$
      into default_owner_id;
    else
      insert into public.owners (
        id,
        display_name,
        legal_name,
        billing_email,
        payment_request_channel,
        payment_due_days,
        active
      )
      values (
        gen_random_uuid(),
        'Daniel & Aurore',
        'Daniel Haque et Aurore Fourrier',
        'dhaque@gmail.com',
        'sms',
        5,
        true
      )
      returning id into default_owner_id;
    end if;
  end if;

  update public.properties
  set owner_id = default_owner_id
  where owner_id is null;
end $$;

create index if not exists properties_owner_id_idx
  on public.properties(owner_id);


-- 3. Owner-aware monthly payment requests.

create table if not exists public.monthly_payment_requests (
  id uuid primary key default gen_random_uuid(),

  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete cascade,

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
  updated_at timestamptz not null default now()
);

-- If the table already existed from earlier attempts, make sure owner_id points to public.owners.
alter table public.monthly_payment_requests
  add column if not exists owner_id uuid,
  add column if not exists owner_recipient_name text,
  add column if not exists owner_recipient_phone text,
  add column if not exists owner_recipient_email text;

alter table public.monthly_payment_requests
  drop constraint if exists monthly_payment_requests_owner_id_fkey;

alter table public.monthly_payment_requests
  add constraint monthly_payment_requests_owner_id_fkey
  foreign key (owner_id) references public.owners(id) on delete cascade;

do $$
begin
  alter table public.monthly_payment_requests
    drop constraint if exists monthly_payment_requests_cleaner_id_period_start_period_end_key;
exception
  when undefined_object then null;
end $$;

create unique index if not exists monthly_payment_requests_cleaner_owner_period_idx
  on public.monthly_payment_requests(cleaner_id, owner_id, period_start, period_end)
  where owner_id is not null;

create unique index if not exists monthly_payment_requests_public_token_idx
  on public.monthly_payment_requests(public_token);


-- 4. Payment request lines.

create table if not exists public.monthly_payment_request_lines (
  id uuid primary key default gen_random_uuid(),

  monthly_payment_request_id uuid not null references public.monthly_payment_requests(id) on delete cascade,

  cleaning_request_id uuid references public.cleaning_requests(id) on delete set null,
  cleaning_report_id uuid references public.cleaning_reports(id) on delete set null,
  extra_id uuid,

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


-- 5. Extras attached to a mission/report.

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


-- 6. Outbound messages can relate to owners/payment requests.

alter table public.outbound_messages
  add column if not exists owner_id uuid,
  add column if not exists monthly_payment_request_id uuid;

alter table public.outbound_messages
  drop constraint if exists outbound_messages_owner_id_fkey;

alter table public.outbound_messages
  add constraint outbound_messages_owner_id_fkey
  foreign key (owner_id) references public.owners(id) on delete set null;

alter table public.outbound_messages
  drop constraint if exists outbound_messages_monthly_payment_request_id_fkey;

alter table public.outbound_messages
  add constraint outbound_messages_monthly_payment_request_id_fkey
  foreign key (monthly_payment_request_id) references public.monthly_payment_requests(id) on delete set null;

notify pgrst, 'reload schema';