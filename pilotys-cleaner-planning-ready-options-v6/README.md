# Pilotys cleaner planning ready options v6

Targeted patch based on the current `app/cleaner/[token]/planning/page.tsx`.

The current file already loads `readyOptionsByRequestId` and passes it into `PropertyPlanningTimeline`, but it never draws those options in the calendar. This patch adds the missing visible overlay.

Changes:
- adds `readyOptionShortLabel()`;
- adds `.eq("is_available", true)` to the ready-day options query;
- overlays ready-day option chips inside each property row;
- each chip links to `/mission/[token]/ready-day?option_id=...`;
- ready-day page highlights the clicked option if it is not already patched.

Apply from repo root:

```bash
bash pilotys-cleaner-planning-ready-options-v6/scripts/install-cleaner-planning-ready-options-v6.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-ready-options-v6/scripts/install-cleaner-planning-ready-options-v6.sh
npm run build
```
