# Pilotys owner token cockpit v25

Operations/calendar cleanup.

- Renames the selector area to Operations and removes the separate Planning header block.
- Keeps the property selector/legend close to the bars.
- Makes property selector cards equal-sized on desktop.
- Reservation bars are clickable.
- Mission markers are clickable and use cleaner avatars/initials with status-coloured rings.
- Timeline uses property thumbnails for arrivals/departures and cleaner avatars/initials for missions.
- Timeline now receives the full year of events rather than being capped to 4 each way, so the scroll area can expose more history/future.
- Après variables chart now shows the variable-cost bar as the negative difference from gross to net.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v25/scripts/install-v25-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
