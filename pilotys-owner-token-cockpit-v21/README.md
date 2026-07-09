# Pilotys owner token cockpit v21

Adds the client-side live ticker rule for CA réalisé.

Rule implemented:
- If no reservation is active today, CA réalisé does not tick.
- Active reservation = checkin_date <= today < checkout_date.
- For active reservations, daily revenue = sum(reservation value / reservation duration).
- The client increments from the 00:00 base value by daily revenue / 86,400 every second.
- The ticker is displayed with 2 decimal places.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v21/scripts/install-v21-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
