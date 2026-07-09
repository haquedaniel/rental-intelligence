# Pilotys owner token cockpit v16

Small compile fix for v15.

v15 used `addMonths()` for the 6-month planning window but the helper was not inserted
in some package builds. v16 adds it explicitly.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v16/scripts/install-v16-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
