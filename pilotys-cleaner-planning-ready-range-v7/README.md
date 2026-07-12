# Pilotys cleaner planning ready range v7

Changes the unconfirmed-mission display from individual day chips to one range bar.

Why:
- the numbers were day-of-month labels for each available ready-day option;
- showing both a mission `!` bubble and date chips was redundant;
- the cleaner should see one clear possible intervention window.

Changes:
- uses existing `cleaning_request_ready_day_options`;
- draws one `Choisir · first → last` bar across the available option range;
- clicking the range opens `/mission/[token]/ready-day`;
- hides the generic `!` mission bubble when a proper ready-option range exists;
- keeps the fallback bubble if no ready-day options exist.

Apply from repo root:

```bash
bash pilotys-cleaner-planning-ready-range-v7/scripts/install-cleaner-planning-ready-range-v7.sh
cd apps/cleaner-web
npm run build
```

Apply from inside `apps/cleaner-web`:

```bash
bash ../../pilotys-cleaner-planning-ready-range-v7/scripts/install-cleaner-planning-ready-range-v7.sh
npm run build
```
