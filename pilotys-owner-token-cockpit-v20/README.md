# Pilotys owner token cockpit v20

Compile fix on top of v19.

This package fixes the missing React hook imports introduced by the auto-scroll planning rail.
I also ran a static sanity check on the generated files for the missing helpers/imports that caused
the last failures.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v20/scripts/install-v20-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
