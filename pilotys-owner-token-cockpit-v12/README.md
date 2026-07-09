# Pilotys owner token cockpit v12

Targets the real Next app under `apps/cleaner-web`.

Changes from v11:

- Reworks the planning calendar into clearer rows with a sticky property label column.
- Separates reservations from mission markers so the calendar is less visually tangled.
- Groups multiple mission markers on the same property/day into a single count badge.
- Adds variable expense line item breakdown to the “Après variables” panel.
- Uses the same expense breakdown logic as the previous working `KpiStrip`: booking expenses from `expense_amount`, variable period costs from `amount_per_day` multiplied through booked daily rows.

Install locally from repo root:

```bash
bash pilotys-owner-token-cockpit-v12/scripts/install-v12-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
