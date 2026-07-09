# Pilotys owner cockpit v10

This package fixes the v8 placement mistake.

The deployed Next.js app is `apps/cleaner-web`, so v10 installs the token owner cockpit into:

- `apps/cleaner-web/app/owner/[ownerToken]/cockpit/*`
- `apps/cleaner-web/app/owner/cockpit/page.tsx` as a legacy redirect/helper
- `apps/cleaner-web/public/pilotys-assets/*`
- `apps/cleaner-web/public/owner/cockpit/manifest.webmanifest`

Run from the repo root:

```bash
bash /path/to/pilotys-owner-token-cockpit-v10/scripts/install-v10-cleaner-web.sh
find apps/cleaner-web/app -path '*owner*cockpit*page.tsx' -print
```

Then build/deploy the cleaner-web app with your normal command.

The data logic is the v8 logic: historical months are realised-only, current month may split realised/future, future months are future-only, and KPI totals are based on deduped property/listing-level analytics rows where available.


## v10
Fixes strict TypeScript build error in `buildMarkers()` by avoiding a nullable map/filter chain.
