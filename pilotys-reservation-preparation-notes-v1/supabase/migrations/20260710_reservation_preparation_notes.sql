begin;

alter table public.reservations
  add column if not exists cleaner_preparation_note text,
  add column if not exists cleaner_preparation_note_updated_at timestamptz,
  add column if not exists cleaner_preparation_note_updated_by text;

alter table public.cleaning_requests
  add column if not exists prepares_reservation_id uuid references public.reservations(id) on delete set null,
  add column if not exists prepares_reservation_linked_at timestamptz,
  add column if not exists prepares_reservation_linked_by text;

create index if not exists reservations_cleaner_preparation_note_idx
  on public.reservations (id)
  where cleaner_preparation_note is not null;

create index if not exists cleaning_requests_prepares_reservation_idx
  on public.cleaning_requests (prepares_reservation_id)
  where prepares_reservation_id is not null;

commit;
