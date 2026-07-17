# Pilotys owner pricing calendar production v4

Focused correction to the pricing calendar reservation layout.

## Behaviour

- Prices are hidden only for occupied nights (`checkin <= date < checkout`).
- The checkout date remains priced because that night is available.
- Market indicators are hidden on occupied nights as they are not actionable.
- Reservation bars still begin and end at midday.
- Reservation bars and market indicators use separate vertical lanes.
- The calendar row is six pixels taller to prevent overlap without materially
  increasing the mobile height.

No database migration is required.
