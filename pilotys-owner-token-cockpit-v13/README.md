# Pilotys owner cockpit v13

Targets `apps/cleaner-web`.

Changes:
- Rebuilds the planning calendar as fixed-height property rows with separate stay and mission lanes, reducing overlay/mangling.
- Keeps the sticky property column but prevents it from covering the calendar content.
- Shows variable-cost line items as visible cards directly under the Après variables bars.
- Makes expense source/amount detection more tolerant of existing analytics_expense_lines columns.

Install from repo root:

```bash
bash pilotys-owner-token-cockpit-v13/scripts/install-v13-cleaner-web.sh
cd apps/cleaner-web
npm run build
```
