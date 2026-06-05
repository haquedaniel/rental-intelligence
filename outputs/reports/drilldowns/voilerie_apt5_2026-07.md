# Profitability drill-down — voilerie / apt5 / 2026-07

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €2 669.12 |
| Accommodation revenue | €2 533.32 |
| Cleaning fee charged to guest | €135.80 |
| Tourist tax | €118.86 |
| Channel commission | €96.09 |
| Host payout | €2 573.03 |
| Host payout less cleaning charged | €2 437.23 |
| Booking-associated costs | €905.38 |
| Fixed allocated costs | €347.71 |
| Estimated operating profit | €1 319.94 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87549003 | airbnb | 2026-07-22 | 2026-08-03 | 12 | €1 548.50 | €85.00 | €60.59 | €58.81 | €1 574.69 | HMNHBNH2TK |
| 87549002 | airbnb | 2026-07-08 | 2026-07-22 | 14 | €1 242.92 | €65.00 | €68.36 | €47.09 | €1 260.83 | HMZK84Q8ZF |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87549003 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-22 | 12 | airbnb | €372.42 |
| 87549003 | cleaning_actual_cost | cleaning_actual_apt5 | fixed_per_booking | 2026-07-22 | 12 | airbnb | €65.00 |
| 87549003 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-22 | 12 | airbnb | €48.00 |
| 87549002 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-08 | 14 | airbnb | €298.96 |
| 87549002 | cleaning_actual_cost | cleaning_actual_apt5 | fixed_per_booking | 2026-07-08 | 14 | airbnb | €65.00 |
| 87549002 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-08 | 14 | airbnb | €56.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €130.00 |
| concierge | €671.38 |
| electricity_usage | €104.00 |

## Fixed / allocated expense detail

| Category | Rule | Calculation | Allocation | Amount |
|---|---|---|---|---:|
| loan_payment | loan_apt5_2026 | fixed_monthly | split_evenly_across_listings | €145.00 |
| copro_charges | copro_apt5_2026 | fixed_monthly | split_evenly_across_listings | €40.00 |
| cfe | cfe_apt5_2026 | fixed_monthly | split_evenly_across_listings | €20.00 |
| home_insurance | home_insurance_apt5_2026 | fixed_monthly | split_evenly_across_listings | €31.71 |
| accounting | accounting_apt5_2026 | fixed_monthly | split_evenly_across_listings | €25.00 |
| property_tax | property_tax_apt5_2026 | fixed_monthly | split_evenly_across_listings | €35.00 |
| housing_tax | housing_tax_apt5_2026 | fixed_monthly | split_evenly_across_listings | €35.00 |
| electricity_subscription | electricity_subscription_apt5_2026 | fixed_monthly | split_evenly_across_listings | €16.00 |

### Fixed expense totals

| Category | Amount |
|---|---:|
| accounting | €25.00 |
| cfe | €20.00 |
| copro_charges | €40.00 |
| electricity_subscription | €16.00 |
| home_insurance | €31.71 |
| housing_tax | €35.00 |
| loan_payment | €145.00 |
| property_tax | €35.00 |

## Notes

- Cleaning fee charged to guest comes from Beds24/OTA booking data.
- Cleaning actual cost comes from the expense rules YAML.
- Fixed costs come from the expense rules YAML and may be allocated by rule.
- Concierge fees are calculated only where expense-rule filters match date, listing and channel.
