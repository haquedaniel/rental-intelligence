# Pilotys owner calendar free-day prices v1

Restores subtle prices on unreserved/free days in the owner planning calendar.

Design:
- only display when the day is not booked/occupied;
- grey/low-contrast small pill near the bottom of the day cell;
- does not change reservation bars.

Fields tried:
- `price_eur`
- `daily_price_eur`
- `rate_eur`
- `recommended_price_eur`
- `public_price_eur`
- `base_price_eur`
- `available_price_eur`
- `min_price_eur`

Apply:

```bash
bash pilotys-owner-calendar-free-day-prices-v1/scripts/install-owner-calendar-free-day-prices-v1.sh
cd apps/cleaner-web
npm run build
```
