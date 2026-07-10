# Pilotys cleaner report preparation note v1

Adds the reservation preparation instruction to the cleaner report/checklist pages — the pages the cleaner is guaranteed to see.

Adds:

```txt
apps/cleaner-web/components/cleaner/CleanerPreparationNoteBanner.tsx
```

Patches, when present:

```txt
/mission/[token]/report
/mission/[token]/intervention/report
```

The banner fetches the mission by public token, then displays:

```txt
reservations.cleaner_preparation_note
```

using:
1. `cleaning_requests.prepares_reservation_id`
2. fallback to `cleaning_requests.reservation_id` if that reservation has a note
3. fallback to inferred next reservation on same property after the mission date

Apply:

```bash
bash pilotys-cleaner-report-preparation-note-v1/scripts/install-cleaner-report-preparation-note-v1.sh
cd apps/cleaner-web
npm run build
```
