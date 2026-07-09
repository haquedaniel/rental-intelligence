# Pilotys owner token cockpit v24

Planning legend/layout fix.

- Removes the sticky property-name column from the Gantt planning area.
- Uses the property selector above the planning as the legend.
- Adds a compact “Légende planning” row under the selector with one color per logement.
- Keeps a tiny colored rail on each planning row for orientation, without consuming horizontal space.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v24/scripts/install-v24-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
