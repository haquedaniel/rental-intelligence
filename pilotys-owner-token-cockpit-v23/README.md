# Pilotys owner token cockpit v23

Fixes the live CA réalisé ticker not moving when reservation rows do not contain revenue.

v22 implemented the client-side ticker, but `activeDailyRevenue` could stay at 0 if the
reservation rows did not carry one of the revenue fields used by `reservationRevenue()`.

v23 keeps the intended rule:
- active reservation = checkin_date <= today < checkout_date
- daily rate = reservation value / duration

and adds a fallback:
- if active reservations exist but their reservation-level revenue is 0,
  use today's `analytics_daily_calendar.host_payout_allocated` value.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v23/scripts/install-v23-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
