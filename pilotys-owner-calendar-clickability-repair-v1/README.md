# Pilotys owner calendar clickability repair v1

Repairs the overly broad pointer-events patch.

It:
- removes broad `pointer-events-none` from owner calendar/cockpit components;
- adds `pointer-events-auto cursor-pointer` only to actual reservation/mission `Link` elements;
- keeps reservation links routed to `/owner/reservations/...`;
- keeps mission links routed to `/owner/missions/...`.

Apply:

```bash
bash pilotys-owner-calendar-clickability-repair-v1/scripts/install-owner-calendar-clickability-repair-v1.sh
cd apps/cleaner-web
npm run build
```
