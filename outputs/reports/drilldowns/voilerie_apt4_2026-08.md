# Profitability drill-down — voilerie / apt4 / 2026-08

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €1 578.54 |
| Accommodation revenue | €1 414.80 |
| Cleaning fee charged to guest | €163.76 |
| Tourist tax | €77.82 |
| Channel commission | €56.83 |
| Host payout | €1 521.73 |
| Host payout less cleaning charged | €1 357.97 |
| Booking-associated costs | €219.15 |
| Fixed allocated costs | €415.71 |
| Estimated operating profit | €886.87 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87590766 | airbnb | 2026-08-10 | 2026-08-13 | 3 | €510.00 | €85.00 | €28.05 | €21.42 | €573.58 | HMKDJ2FQX8 |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87590766 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-08-10 | 3 | airbnb | €122.15 |
| 87590766 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-08-10 | 3 | airbnb | €85.00 |
| 87590766 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-08-10 | 3 | airbnb | €12.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €85.00 |
| concierge | €122.15 |
| electricity_usage | €12.00 |

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
