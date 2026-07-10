# Pilotys owner branding pass v1

Brand/UI pass for owner-side pages.

Scope:
- replaces `components/owner/OwnerBottomNav.tsx` with a Pilotys-styled top/bottom nav;
- keeps tokenized owner cockpit links when the current URL is `/owner/[ownerToken]/cockpit`;
- applies brand colors to owner/admin owner-facing pages;
- adds subtle Pilotys ribbons to simple owner pages;
- avoids public cleaner mission/report/checklist pages.

It intentionally does **not** touch:
- `app/mission/**`
- `app/cleaner/**`
- `OwnerCockpit.tsx`
- `OwnerDemoCockpit.tsx`
- action files

Apply:

```bash
bash pilotys-owner-branding-pass-v1/scripts/install-owner-branding-pass-v1.sh
cd apps/cleaner-web
npm run build
```
