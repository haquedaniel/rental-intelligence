# Profitability drill-down — voilerie / apt4 / 2026-05

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €371.40 |
| Accommodation revenue | €0.00 |
| Cleaning fee charged to guest | €0.00 |
| Tourist tax | €0.00 |
| Channel commission | €0.00 |
| Host payout | €371.40 |
| Host payout less cleaning charged | €371.40 |
| Booking-associated costs | €260.26 |
| Fixed allocated costs | €415.71 |
| Estimated operating profit | €-304.57 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87695973 | airbnb | 2026-05-26 | 2026-06-04 | 9 | €0.00 | €0.00 | €0.00 | €0.00 | €557.06 | HMPHDPN2JK |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87695973 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-05-26 | 9 | airbnb | €139.26 |
| 87695973 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-05-26 | 9 | airbnb | €85.00 |
| 87695973 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-05-26 | 9 | airbnb | €36.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €85.00 |
| concierge | €139.26 |
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
