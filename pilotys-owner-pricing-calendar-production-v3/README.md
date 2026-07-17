# Pilotys owner pricing calendar production v3

Follow-up to v2 based on the first production mobile rendering.

## Changes

- Replaces continuous season tracks with a subtle coloured dot beside the date.
- Shows only seasons actually used by calculated dates in the visible month.
- Places reservations in a dedicated lane between prices and market indicators.
- Keeps market indicators in their own bottom lane so bars never cover them.
- Corrects half-day reservation geometry at check-in and checkout.
- Calculates reservation totals through the cockpit's existing robust fallback chain:
  explicit reservation revenue, reservation-level daily analytics, then average nightly value.

No database migration is required.
