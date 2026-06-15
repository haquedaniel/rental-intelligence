alter table public.outbound_messages
    add column if not exists event_key text;

alter table public.outbound_messages
    drop constraint if exists outbound_messages_cleaning_request_id_channel_message_type_key;

create unique index if not exists outbound_messages_event_key_idx
on public.outbound_messages(event_key)
where event_key is not null;

notify pgrst, 'reload schema';
