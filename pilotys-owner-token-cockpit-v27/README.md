# Pilotys owner token cockpit v27

Thumbnail/image fix.

- Makes property thumbnail detection more tolerant of common column names:
  cover_photo_url, photo_url, image_url, thumbnail_url, photos/images arrays, storage paths, etc.
- Attempts signed URLs for property storage paths from common buckets.
- Adds equivalent cleaner profile image detection/signing.
- Uses cleaner signed images in planning mission avatars and timeline mission avatars.
- Shows listing initials if no thumbnail is available, rather than an empty box.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v27/scripts/install-v27-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
