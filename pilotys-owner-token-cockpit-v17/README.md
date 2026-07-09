# Pilotys owner token cockpit v17

Small compile fix for v16.

The date helper in this generated data.ts is named `dateAtNoon`, not
`dateAtNoonUtc`. v17 fixes `addMonths()` to use the existing helper.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v17/scripts/install-v17-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
