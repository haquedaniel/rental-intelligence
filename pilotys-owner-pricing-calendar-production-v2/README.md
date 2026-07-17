# Owner pricing calendar production v2

Grounded against `rental-intelligence-current(1).zip`.

Changes:
- compact full-month mobile pricing calendar under Operations;
- continuous, subtle season tracks under dates;
- seven-level adaptive discrete market bars at the bottom of each day;
- reservation bars in a dedicated lane, so they never cover market indicators;
- half-day reservation start/end and first name + total value;
- tappable prices with explanation drawer;
- properties without calculated pricing collapsed;
- Timeline and À tester replaced by recent Journal situation headlines.

The market display uses the month's 90th percentile with a 3% minimum scale. This intentionally makes small real changes visible without allowing one outlier to flatten the whole month.

No database migration is required.
