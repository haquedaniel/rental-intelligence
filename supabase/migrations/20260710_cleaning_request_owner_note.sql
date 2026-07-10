begin;

alter table public.cleaning_requests
  add column if not exists owner_note text,
  add column if not exists cleaner_priority_note text,
  add column if not exists owner_note_updated_at timestamptz,
  add column if not exists owner_note_updated_by text;

create index if not exists cleaning_requests_owner_note_idx
  on public.cleaning_requests (id)
  where owner_note is not null or cleaner_priority_note is not null;

commit;
