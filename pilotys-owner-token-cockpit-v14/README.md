# Pilotys owner token cockpit v14

Fixes the planning-window bug from v13.

v13 made the planning visually cleaner but still started the visible window at today.
That means every reservation already in progress was clipped and appeared to start
on the first visible day.

v14 starts the owner planning at the first day of the current month, so reservation
bars show their real July positions instead of all starting on today.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v14/scripts/install-v14-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
