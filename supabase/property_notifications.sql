create table if not exists public.property_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text,
  phone text,
  email text,
  channel text not null default 'sms',
  alert_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_notification_recipients_property_idx
  on public.property_notification_recipients(property_id);

create index if not exists property_notification_recipients_alert_idx
  on public.property_notification_recipients(property_id, alert_type, enabled);

create unique index if not exists property_notification_recipients_unique_sms
  on public.property_notification_recipients(property_id, alert_type, channel, phone)
  where enabled = true and phone is not null;

insert into public.property_notification_recipients (
  property_id,
  name,
  phone,
  channel,
  alert_type,
  enabled
)
values (
  '20000000-0000-0000-0000-000000000001',
  'Daniel',
  '+33687744714',
  'sms',
  'cleaning_overdue',
  true
)
on conflict do nothing;