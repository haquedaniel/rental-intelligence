# Pilotys cleaner navigation + briefing v2

This package follows the current cleaner homepage/navigation style and connects the new briefing page.

## Adds

- `components/navigation/CleanerMissionNav.tsx`
  - Resolves a mission public token to its assigned cleaner and renders the existing `CleanerBottomNav`.

- `/mission/[token]/reservation`
  - Cleaner-only stay briefing with no financials / owner correspondence / owner audit details.
  - Includes the cleaner bottom nav.

## Patches

- Existing mission sub-pages, if present:
  - `/mission/[token]`
  - `/mission/[token]/ready-day`
  - `/mission/[token]/report`
  - `/mission/[token]/intervention`
  - `/mission/[token]/reservation`

  They receive `CleanerMissionNav` and a `Briefing séjour` shortcut.

- Cleaner planning calendar:
  - mission compact cards get a `Briefing séjour` button;
  - stay bars in the horizontal calendar link to `/mission/[public_token]/reservation` when a linked mission exists.

## Apply

```bash
bash pilotys-cleaner-navigation-briefing-v2/scripts/install-cleaner-navigation-briefing-v2.sh
cd apps/cleaner-web
npm run build
```
