# Pilotys owner navigation + missions v2

This package makes the new owner detail pages feel like part of the same owner app.

## Adds

- `components/owner/OwnerBottomNav.tsx`
  - mobile bottom nav with quick return to cockpit
  - desktop top nav helper
- `app/owner/missions/[requestId]/page.tsx`
  - owner-side mission detail page
  - property/reservation context
  - cleaner, time window, ready-before deadline, cost
  - report/photo preview
  - links back to reservation/report/cockpit
- updated `app/owner/reservations/[reservationId]/page.tsx`
  - includes owner top nav and mobile bottom nav
  - mission links now prefer `/owner/missions/[requestId]`

## Installer also soft-patches

If present, it adds the bottom nav to:

- `app/owner/reports/[requestId]/page.tsx`
- `app/owner/issues/request/[requestId]/page.tsx`
- `app/owner/issues/missing/[reservationId]/page.tsx`
- `app/owner/payments/page.tsx`

It also tries to patch cockpit/component links from old `/owner/issues/request/...` routes to the new `/owner/missions/...` route.

## Apply

From repo root:

```bash
bash pilotys-owner-navigation-missions-v1/scripts/install-owner-navigation-missions-v2.sh
cd apps/cleaner-web
npm run build
```

## Open

Reservation:

```txt
/owner/reservations/<reservation_uuid>
```

Mission:

```txt
/owner/missions/<cleaning_request_uuid>
```


## v2 fix

Fixes TypeScript inference for signed report/intervention photos on the mission page.
