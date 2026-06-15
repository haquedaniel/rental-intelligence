create table if not exists public.outbound_messages (
    id uuid primary key default gen_random_uuid(),
    cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
    channel text not null check (channel in ('sms', 'whatsapp', 'email')),
    message_type text not null,
    recipient_phone text,
    body text not null,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
    provider text,
    provider_message_id text,
    provider_to text,
    attempt_count integer not null default 0,
    last_attempt_at timestamptz,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (cleaning_request_id, channel, message_type)
);

create index if not exists outbound_messages_status_idx
on public.outbound_messages(status, created_at);

grant select, insert, update, delete on public.outbound_messages to service_role;

notify pgrst, 'reload schema';
