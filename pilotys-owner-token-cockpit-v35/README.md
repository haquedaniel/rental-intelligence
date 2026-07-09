# Pilotys owner token cockpit v35

Single-line planning row per property.

Changes:
- Reservations and cleaning/intervention missions now share one horizontal line per property.
- Reservation bars start halfway through the check-in day and end halfway through checkout day.
- Mission bubbles sit in the centre of their day.
- Connector lines are vertically centred on the property row.
- Reservation text is centred and retains full details in the mouseover tooltip.

Apply from the repo root:

```bash
bash pilotys-owner-token-cockpit-v35/scripts/install-v35-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
