# Pilotys owner token cockpit v18

Small compile fix for v17.

The generated `data.ts` did not have `dateKeyFromUtcDate()`. v18 makes
`addMonths()` self-contained.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v18/scripts/install-v18-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
