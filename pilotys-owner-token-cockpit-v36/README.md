# Pilotys owner token cockpit v36

Planning cleanup.

Changes:
- Multiple-mission chooser overlay is strengthened so it renders above the calendar rather than as a clipped/blank box.
- Cancelled and refused missions are filtered out of the planning markers and reservation cleaning coverage.
- Free-day prices under/around reservations are visually hidden.
- Reservation bars now show only the guest/name, centred.
- Reservation mouseover tooltip includes guest/name, total, nights, nightly rate and cleaning status.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v36/scripts/install-v36-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
