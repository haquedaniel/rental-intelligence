# Pilotys owner token cockpit v30

Front-end cleanup before moving À retenir logic to Python.

Changes:
- Multiple missions on the same property/day no longer link to an arbitrary mission.
  The numbered badge now opens a popover with one clickable row per mission.
- Reservation guest-name priority now prefers real guest/name fields before booking codes.
- Temporary À retenir logic no longer falls back to arbitrary timeline events/booking codes.
  It only shows an orange/action/payment event, otherwise “Tout est à jour.”

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v30/scripts/install-v30-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
