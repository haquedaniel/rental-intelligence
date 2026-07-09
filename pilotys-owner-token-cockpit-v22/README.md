# Pilotys owner token cockpit v22

Compile fix for v21.

v21 added required live ticker fields to FinancialSummary but the internal
buildFinancial() function still returned the old shape. v22 adds default values
there, then the page-level data assembly overwrites them with the real
client-side ticker inputs.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v22/scripts/install-v22-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
