# Pilotys UI unification pass v2

Unifies the owner bottom navigation and adds a discrete Pilotys polish across the rest of the app.

Fixes:
- cockpit owner bottom nav now matches the detail-page owner bottom nav;
- owner detail bottom nav labels are aligned: Cockpit, Séjours, Missions, €, Réglages;
- duplicate OwnerBottomNav imports are cleaned if present.

Discrete brand pass:
- global warm app background and navy foreground;
- orange focus/selection/accent states;
- softer admin/owner/cleaner surfaces;
- conservative brand colour replacements on admin/cleaner/mission/owner pages;
- does not structurally redesign the cleaner report/checklist.

Works from repo root or from `apps/cleaner-web`.

Apply from repo root:

```bash
bash pilotys-ui-unification-pass-v2/scripts/install-ui-unification-pass-v2.sh
cd apps/cleaner-web
npm run build
```

Apply from `apps/cleaner-web`:

```bash
bash ../../pilotys-ui-unification-pass-v2/scripts/install-ui-unification-pass-v2.sh
npm run build
```
