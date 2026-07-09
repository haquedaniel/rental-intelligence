# Pilotys owner token cockpit v28

Exact thumbnail fix.

This stops guessing and uses the known existing data model:

Properties:
- Query `property_reference_photos`
- Filter by selected property IDs and `is_active = true`
- Order by `is_cover desc`, then `display_order asc`
- Sign `storage_bucket` + `storage_path`
- Attach that signed URL to each property as `cover_photo_signed_url`

Cleaners:
- Sign `cleaners.profile_photo_bucket` + `cleaners.profile_photo_path`
- Attach as `profile_photo_signed_url`

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v28/scripts/install-v28-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
