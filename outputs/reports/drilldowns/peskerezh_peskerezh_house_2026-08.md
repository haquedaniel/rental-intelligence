# Profitability drill-down — peskerezh / peskerezh_house / 2026-08

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €4 500.60 |
| Accommodation revenue | €4 215.60 |
| Cleaning fee charged to guest | €285.00 |
| Tourist tax | €162.94 |
| Channel commission | €162.04 |
| Host payout | €4 338.56 |
| Host payout less cleaning charged | €4 053.56 |
| Booking-associated costs | €1 126.81 |
| Fixed allocated costs | €659.23 |
| Estimated operating profit | €2 552.52 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87301138 | airbnb | 2026-08-17 | 2026-08-23 | 6 | €1 628.40 | €120.00 | €51.18 | €62.94 | €1 685.46 | HMWWSX9EMJ |
| 87301137 | airbnb | 2026-08-08 | 2026-08-15 | 7 | €1 844.50 | €120.00 | €84.54 | €70.73 | €1 893.77 | HMBBNWF84Y |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87301138 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-08-17 | 6 | airbnb | €391.37 |
| 87301138 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-08-17 | 6 | airbnb | €120.00 |
| 87301138 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-08-17 | 6 | airbnb | €24.00 |
| 87301137 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-08-08 | 7 | airbnb | €443.44 |
| 87301137 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-08-08 | 7 | airbnb | €120.00 |
| 87301137 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-08-08 | 7 | airbnb | €28.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €240.00 |
| concierge | €834.81 |
| electricity_usage | €52.00 |

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
