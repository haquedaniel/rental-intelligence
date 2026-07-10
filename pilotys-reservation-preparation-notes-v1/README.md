# Pilotys reservation preparation notes v1

This pivots from mission-level notes to reservation-level preparation instructions.

## Source of truth

```txt
reservations.cleaner_preparation_note
```

## Operational link

```txt
cleaning_requests.prepares_reservation_id
```

The existing workflow is not changed:
- mission creation remains as-is;
- cleaner accept/refuse remains as-is;
- ready-day/report flow remains as-is;
- `cleaning_requests.reservation_id` remains the checkout/source reservation.

## Apply

From repo root:

```bash
bash pilotys-reservation-preparation-notes-v1/scripts/install-reservation-preparation-notes-v1.sh
```

Apply the SQL in Supabase:

```sql
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
```

Then run:

```bash
python scripts/reconcile_prepares_reservation_links.py --dry-run
python scripts/reconcile_prepares_reservation_links.py
cd apps/cleaner-web
npm run build
```

The reconciliation script only relinks safe statuses: `created`, `sent`, `pending`, `proposed`, `accepted`. It prints warnings for completed/refused/cancelled missions instead of changing history.
