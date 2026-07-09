# Pilotys owner token cockpit v19

Compile fix on top of v18.

`planningEnd` is now declared before the Supabase queries that use it.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v19/scripts/install-v19-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
