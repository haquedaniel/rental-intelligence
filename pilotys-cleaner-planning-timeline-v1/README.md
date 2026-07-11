# Pilotys cleaner planning timeline v1

Replaces the cleaner planning page with an owner-calendar-inspired 6-month work timeline.

Features:
- 6-month horizon;
- property thumbnail + colour legend above the calendar;
- no bulky property-name column on the left;
- owner-style half-day reservation bars;
- mission / intervention layer below stays;
- proposed / accepted / completed / problem status outlines;
- current cleaner vs other cleaner distinction;
- profile photos for accepted / completed missions when available;
- proposed mission windows that link to ready-day selection;
- stay bars link to `Briefing séjour` when a linked mission exists;
- uses `prepares_reservation_id` as well as `reservation_id`.

Scope:
- replaces only `app/cleaner/[token]/planning/page.tsx`
- does not touch mission/report/checklist pages

Apply from repo root:

```bash
bash pilotys-cleaner-planning-timeline-v1/scripts/install-cleaner-planning-timeline-v1.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-timeline-v1/scripts/install-cleaner-planning-timeline-v1.sh
npm run build
```
