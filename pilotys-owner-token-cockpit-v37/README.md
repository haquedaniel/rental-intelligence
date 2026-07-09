# Pilotys owner token cockpit v37

Calendar aesthetic refinement.

Changes:
- Removes the tiny status bubble on the reservation; the coloured border is now the reservation status signal.
- Adds a real hover card for reservation details:
  - guest/name
  - total value
  - number of nights
  - nightly rate
  - cleaning status
- Softens reservation border/shadow styling.
- Makes mission bubbles slightly smaller so they feel less intrusive on the row.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v37/scripts/install-v37-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
