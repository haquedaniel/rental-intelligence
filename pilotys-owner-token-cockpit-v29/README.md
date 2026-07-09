# Pilotys owner token cockpit v29

Compile fix for v28.

The fallback branch for `property_reference_photos` returned `{ data: [] }`, while
real Supabase responses include an `error` property. v29 makes fallback responses
use `{ data: [], error: null }` and guards the error loop.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v29/scripts/install-v29-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
