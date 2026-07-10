# Pilotys cleaner correspondence + owner note v3

Adds the missing operational layer:

## Database migration

`supabase/migrations/20260710_cleaning_request_owner_note.sql`

Adds to `cleaning_requests`:

- `owner_note`
- `cleaner_priority_note`
- `owner_note_updated_at`
- `owner_note_updated_by`

## Owner mission page

`/owner/missions/[requestId]`

Adds an owner form to save a priority note visible to the cleaner.

The note is also written into `cleaning_request_change_log` as `owner_note_updated`.

## Cleaner pages

`/mission/[token]/reservation`

Now includes:

- priority owner note at the top;
- selected operational guest correspondence from `reservation_messages`;
- still hides financials and owner audit details.

Installer also tries to patch the main `/mission/[token]` page so the owner note appears first there too, plus a `Briefing séjour` shortcut.

## Apply

From repo root:

```bash
bash pilotys-cleaner-correspondence-owner-note-v1/scripts/install-cleaner-correspondence-owner-note-v3.sh
cd apps/cleaner-web
npm run build
```

Also apply the SQL migration in Supabase.


## v2 fix

Removes the unsafe automatic owner-note injection into `/mission/[token]/page.tsx` that assumed the mission variable was named `request`. The note still appears on `/mission/[token]/reservation`, and the installer repairs the broken v1 block if it was already inserted.


## v3 fix

Fixes TypeScript inference for `operationalMessages` on `/mission/[token]/reservation`.
