# Pilotys owner app structure v1

This patch introduces the new owner-facing information architecture:

- Dashboard: finance, owner summary, occupancy calendar, journal headlines.
- Operations: important actions, cleaner/intervention calendar, payments and history.
- Pricing: pricing calendar first, with a deliberate link to advanced settings.
- Settings: owner-focused dispatch page.
- Journal/notifications remain accessible from the header icon.
- Internal `/admin` becomes a separate back-office dispatch page and is not linked from the owner app.

## Routes

- `/owner/[ownerToken]/cockpit`
- `/owner/[ownerToken]/operations`
- `/owner/[ownerToken]/operations/payments`
- `/owner/[ownerToken]/pricing`
- `/owner/[ownerToken]/pricing/settings`
- `/owner/[ownerToken]/admin`
- `/owner/[ownerToken]/activity`
- `/admin` (internal only)

## Notes

The old owner pricing configuration page is moved to `/pricing/settings`; its server actions remain in `/pricing/actions.ts`.
The token-aware payment page filters requests by owner.
