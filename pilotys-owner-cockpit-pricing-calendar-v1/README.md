# Owner cockpit pricing calendar v1

Changes against the uploaded current source tree:

- Adds the explainable pricing calendar directly below the existing operational planning calendar.
- Uses the existing property selector for both calendars.
- Renders reservation bars from midday on check-in day to midday on checkout day.
- Replaces pricing-origin badges with a single `? Pourquoi ce prix ?` affordance.
- Replaces the lower `Timeline` and `À tester` blocks with recent non-preview owner briefings and a link to the full Journal.
- Loads one year of current pricing calendar rows plus the latest eight real briefings.

No database migration is required.

## Install

```bash
bash pilotys-owner-cockpit-pricing-calendar-v1/install.sh
docker compose up -d --build cleaner-web
```

The installer backs up replaced files under `.pilotys-backups/`.

## Validation note

The uploaded archive did not contain `node_modules`, so a local TypeScript/Next build could not be run in the isolated patch environment. The patch is deliberately limited to existing components, tables, and types already present in the repository.
