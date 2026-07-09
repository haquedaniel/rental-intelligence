# Pilotys owner token cockpit v26

Compile fix for v25.

v25 referenced helper functions such as `reservationHref()` but, in the packaged
file, those helper declarations were not inserted. v26 adds them explicitly and
adds a sanity check that referenced helpers are declared.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v26/scripts/install-v26-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
