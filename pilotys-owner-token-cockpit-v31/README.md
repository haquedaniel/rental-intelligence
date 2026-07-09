# Pilotys owner token cockpit v31

Fixes temporary À retenir selection and grouped mission chooser.

Changes:
- À retenir no longer treats normal orange arrivals/departures as action items.
  It only picks orange cleaning/intervention events or payment events.
- Reservation display fallback no longer shows raw booking codes; it falls back to “Client”.
- Multiple missions on the same property/day now open a fixed chooser overlay,
  so all missions are visible and individually clickable, without being clipped by the planning row.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v31/scripts/install-v31-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
