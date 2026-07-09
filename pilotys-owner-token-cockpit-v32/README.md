# Pilotys owner token cockpit v32

Calendar readability fix.

Changes:
- Reservation bars now show a cleaning coverage border:
  - red: no cleaning mission linked to the reservation
  - orange: mission exists but is not accepted/completed
  - green: mission is accepted/completed/report submitted
- Adds a small status dot inside each reservation bar.
- Adds a horizontal connector line from each reservation to its associated mission day.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v32/scripts/install-v32-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
