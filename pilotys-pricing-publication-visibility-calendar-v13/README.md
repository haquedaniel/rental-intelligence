# Pilotys publication visibility and reservation calendar v13

Adds:

- live publication progress with counts, percentage, queue details, automatic 10-second refresh, next-run countdown, and estimated time remaining;
- corrected live/preview wording;
- reservations displayed as continuous bubbles spanning their booked nights, split only where a calendar week wraps;
- reservation details in the daily explanation drawer.

Install from the repository root:

```bash
bash pilotys-pricing-publication-visibility-calendar-v13/install.sh
docker compose up -d --build cleaner-web
```

No database migration or Python service rebuild is required.
