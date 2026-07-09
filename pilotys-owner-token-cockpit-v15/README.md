# Pilotys owner token cockpit v15

Planning behaviour fix.

- The planning now covers 6 months before today and 6 months after today.
- It automatically scrolls horizontally to today's date on load.
- This avoids clipping many historical/in-progress reservations onto the first visible day.
- Financial KPIs still remain annual/current-year as before.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v15/scripts/install-v15-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
