# Pilotys owner calendar targeted fix v1

Targeted fix for the owner planning calendar.

Fixes:
- reservations blocked by the full-row mission overlay;
- free-day prices hidden as `sr-only`.

Specific changes:
- mission overlay container gets `pointer-events-none`;
- actual mission bubble wrapper gets `pointer-events-auto`;
- reservation layer stays clickable;
- hidden free-day price becomes a subtle visible grey price;
- free-day cells get `relative`.

Apply:

```bash
bash pilotys-owner-calendar-targeted-fix-v1/scripts/install-owner-calendar-targeted-fix-v1.sh
cd apps/cleaner-web
npm run build
```
