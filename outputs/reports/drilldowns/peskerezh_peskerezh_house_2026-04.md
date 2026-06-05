# Profitability drill-down — peskerezh / peskerezh_house / 2026-04

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €690.00 |
| Accommodation revenue | €570.00 |
| Cleaning fee charged to guest | €120.00 |
| Tourist tax | €31.35 |
| Channel commission | €24.84 |
| Host payout | €665.16 |
| Host payout less cleaning charged | €545.16 |
| Booking-associated costs | €268.29 |
| Fixed allocated costs | €659.23 |
| Estimated operating profit | €-262.36 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87301131 | airbnb | 2026-04-27 | 2026-04-30 | 3 | €570.00 | €120.00 | €31.35 | €24.84 | €665.16 | HMTH2SZACE |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87301131 | concierge | concierge_peskerezh_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-04-27 | 3 | airbnb | €136.29 |
| 87301131 | cleaning_actual_cost | cleaning_actual_peskerezh | fixed_per_booking | 2026-04-27 | 3 | airbnb | €120.00 |
| 87301131 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-04-27 | 3 | airbnb | €12.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €120.00 |
| concierge | €136.29 |
| electricity_usage | €12.00 |

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
