# Profitability drill-down — peskerezh / peskerezh_house / 2026-05

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €1 330.00 |
| Accommodation revenue | €1 130.00 |
| Cleaning fee charged to guest | €200.00 |
| Tourist tax | €62.15 |
| Channel commission | €47.88 |
| Host payout | €1 282.12 |
| Host payout less cleaning charged | €1 082.12 |
| Booking-associated costs | €530.53 |
| Fixed allocated costs | €659.23 |
| Estimated operating profit | €92.36 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87301133 | airbnb | 2026-05-08 | 2026-05-10 | 2 | €560.00 | €80.00 | €30.80 | €23.04 | €616.96 | HMAZCBWDTR |
| 87301132 | airbnb | 2026-05-04 | 2026-05-07 | 3 | €570.00 | €120.00 | €31.35 | €24.84 | €665.16 | HM9Y9CRTPA |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87301133 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-05-08 | 2 | airbnb | €134.24 |
| 87301133 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-05-08 | 2 | airbnb | €120.00 |
| 87301133 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-05-08 | 2 | airbnb | €8.00 |
| 87301132 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-05-04 | 3 | airbnb | €136.29 |
| 87301132 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-05-04 | 3 | airbnb | €120.00 |
| 87301132 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-05-04 | 3 | airbnb | €12.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €240.00 |
| concierge | €270.53 |
| electricity_usage | €20.00 |

## Fixed / allocated expense detail

| Category | Rule | Calculation | Allocation | Amount |
|---|---|---|---|---:|
| loan_payment | loan_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €500.00 |
| cfe | cfe_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €20.00 |
| home_insurance | home_insurance_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €48.23 |
| accounting | accounting_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €25.00 |
| property_tax | property_tax_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €50.00 |
| electricity_subscription | electricity_subscription_peskerezh_house_2026 | fixed_monthly | split_evenly_across_listings | €16.00 |

### Fixed expense totals

| Category | Amount |
|---|---:|
| accounting | €25.00 |
| cfe | €20.00 |
| electricity_subscription | €16.00 |
| home_insurance | €48.23 |
| loan_payment | €500.00 |
| property_tax | €50.00 |

## Notes

- Cleaning fee charged to guest comes from Beds24/OTA booking data.
- Cleaning actual cost comes from the expense rules YAML.
- Fixed costs come from the expense rules YAML and may be allocated by rule.
- Concierge fees are calculated only where expense-rule filters match date, listing and channel.
