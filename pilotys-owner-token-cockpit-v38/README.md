# Pilotys owner token cockpit v38

Fixes calendar date offset.

The visible calendar grid uses Tailwind `gap-1` between day cells, but v35-v37 positioned
reservations/missions/connectors using only `dayWidthPx = 76`. That ignored the 4px gap
between every day, creating cumulative horizontal drift versus the date headers.

v38 makes the absolute positioning gap-aware:
- day pitch = `dayWidthPx + 4`
- reservations start at the centre of check-in day
- reservations end at the centre of checkout day
- mission bubbles and connector lines use the same day-centre calculation

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v38/scripts/install-v38-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
