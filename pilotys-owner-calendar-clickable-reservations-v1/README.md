# Pilotys owner calendar clickable reservations v1

Small targeted patch for owner calendar reservation bars.

It:
- keeps reservation links routed to `/owner/reservations/[reservationId]`;
- makes calendar background/absolute grid layers `pointer-events-none`;
- makes reservation links `pointer-events-auto cursor-pointer`;
- raises reservation link z-index with `z-30`.

Apply from repo root:

```bash
bash pilotys-owner-calendar-clickable-reservations-v1/scripts/install-owner-calendar-clickable-reservations-v1.sh
cd apps/cleaner-web
npm run build
```
