# Profitability drill-down — voilerie / apt4 / 2026-03

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €461.05 |
| Accommodation revenue | €393.22 |
| Cleaning fee charged to guest | €45.88 |
| Tourist tax | €21.94 |
| Channel commission | €0.00 |
| Host payout | €461.05 |
| Host payout less cleaning charged | €415.17 |
| Booking-associated costs | €121.00 |
| Fixed allocated costs | €415.71 |
| Estimated operating profit | €-75.66 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87720077 | direct | 2026-03-31 | 2026-04-09 | 9 | €596.00 | €85.00 | €34.05 | €0.00 | €715.05 | nan |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87720077 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-03-31 | 9 | direct | €85.00 |
| 87720077 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-03-31 | 9 | direct | €36.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €85.00 |
| electricity_usage | €36.00 |

## Fixed / allocated expense detail

| Category | Rule | Calculation | Allocation | Amount |
|---|---|---|---|---:|
| loan_payment | loan_apt4_2026 | fixed_monthly | split_evenly_across_listings | €226.00 |
| copro_charges | copro_apt4_2026 | fixed_monthly | split_evenly_across_listings | €62.00 |
| cfe | cfe_apt4_2026 | fixed_monthly | split_evenly_across_listings | €20.00 |
| home_insurance | home_insurance_apt4_2026 | fixed_monthly | split_evenly_across_listings | €31.71 |
| accounting | accounting_apt4_2026 | fixed_monthly | split_evenly_across_listings | €25.00 |
| property_tax | property_tax_apt4_2026 | fixed_monthly | split_evenly_across_listings | €35.00 |
| electricity_subscription | electricity_subscription_apt4_2026 | fixed_monthly | split_evenly_across_listings | €16.00 |

### Fixed expense totals

| Category | Amount |
|---|---:|
| accounting | €25.00 |
| cfe | €20.00 |
| copro_charges | €62.00 |
| electricity_subscription | €16.00 |
| home_insurance | €31.71 |
| loan_payment | €226.00 |
| property_tax | €35.00 |

## Notes

- Cleaning fee charged to guest comes from Beds24/OTA booking data.
- Cleaning actual cost comes from the expense rules YAML.
- Fixed costs come from the expense rules YAML and may be allocated by rule.
- Concierge fees are calculated only where expense-rule filters match date, listing and channel.
