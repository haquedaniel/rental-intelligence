# Profitability drill-down — peskerezh / peskerezh_house / 2026-07

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €3 710.80 |
| Accommodation revenue | €3 435.80 |
| Cleaning fee charged to guest | €275.00 |
| Tourist tax | €119.61 |
| Channel commission | €153.77 |
| Host payout | €3 557.03 |
| Host payout less cleaning charged | €3 282.03 |
| Booking-associated costs | €1 551.09 |
| Fixed allocated costs | €659.23 |
| Estimated operating profit | €1 346.71 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87535251 | booking | 2026-07-10 | 2026-07-11 | 1 | €189.00 | €0.00 | €0.00 | €27.00 | €162.00 | 5197367661 |
| 87301136 | airbnb | 2026-07-27 | 2026-08-04 | 8 | €1 980.50 | €120.00 | €72.62 | €75.62 | €2 024.88 | HMX892ZXWJ |
| 87301135 | airbnb | 2026-07-11 | 2026-07-18 | 7 | €1 449.00 | €120.00 | €46.49 | €56.48 | €1 512.52 | HMXWBQS4RM |
| 87301134 | airbnb | 2026-07-03 | 2026-07-05 | 2 | €560.00 | €80.00 | €27.72 | €23.04 | €616.96 | HMYDZ2YAE9 |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87535251 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-10 | 1 | booking | €40.50 |
| 87535251 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-07-10 | 1 | booking | €120.00 |
| 87535251 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-10 | 1 | booking | €4.00 |
| 87301136 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-27 | 8 | airbnb | €476.22 |
| 87301136 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-07-27 | 8 | airbnb | €120.00 |
| 87301136 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-27 | 8 | airbnb | €32.00 |
| 87301135 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-11 | 7 | airbnb | €348.13 |
| 87301135 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-07-11 | 7 | airbnb | €120.00 |
| 87301135 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-11 | 7 | airbnb | €28.00 |
| 87301134 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-03 | 2 | airbnb | €134.24 |
| 87301134 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-07-03 | 2 | airbnb | €120.00 |
| 87301134 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-03 | 2 | airbnb | €8.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €480.00 |
| concierge | €999.09 |
| electricity_usage | €72.00 |

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
