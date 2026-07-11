# Pilotys cleaner planning ready options v4

Shows existing ready-day options on the cleaner planning calendar.

Important: this does not recalculate possible days. It uses the existing source of truth:

```txt
cleaning_request_ready_day_options
```

Changes:
- loads available ready-day options for unconfirmed missions;
- displays option chips on the calendar instead of only a broad inferred window;
- each chip links to `/mission/[token]/ready-day?option_id=...`;
- ready-day page highlights the option passed in the URL;
- accept action remains unchanged and still accepts by `option_id`.

Apply from repo root:

```bash
bash pilotys-cleaner-planning-ready-options-v4/scripts/install-cleaner-planning-ready-options-v4.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-ready-options-v4/scripts/install-cleaner-planning-ready-options-v4.sh
npm run build
```
