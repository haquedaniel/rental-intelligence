# Pilotys owner calendar correct own prices v1

Fixes free-day pricing in the owner planning calendar.

The calendar should show prices only when the own Beds24 scenario is genuinely bookable.

Rules:
- prefer `own_nightly_amount`;
- require `bookable` when present;
- require positive `units_available` when present;
- hide values below 25 EUR/night, to avoid bogus fallback prices like 5 EUR;
- fall back to `own_total_amount / nights` only when no nightly amount exists.

Apply:

```bash
bash pilotys-owner-calendar-correct-own-prices-v1/scripts/install-owner-calendar-correct-own-prices-v1.sh
cd apps/cleaner-web
npm run build
```
