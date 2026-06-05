# Profitability drill-down — voilerie / apt5 / 2026-08

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €1 820.30 |
| Accommodation revenue | €1 721.10 |
| Cleaning fee charged to guest | €99.20 |
| Tourist tax | €36.91 |
| Channel commission | €65.54 |
| Host payout | €1 754.76 |
| Host payout less cleaning charged | €1 655.56 |
| Booking-associated costs | €460.82 |
| Fixed allocated costs | €347.71 |
| Estimated operating profit | €946.23 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87549004 | airbnb | 2026-08-05 | 2026-08-16 | 11 | €1 463.00 | €85.00 | €26.82 | €55.73 | €1 492.27 | HM8PQ3YRP3 |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87549004 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-08-05 | 11 | airbnb | €351.82 |
| 87549004 | cleaning_actual_cost | cleaning_actual_apt5 | fixed_per_booking | 2026-08-05 | 11 | airbnb | €65.00 |
| 87549004 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-08-05 | 11 | airbnb | €44.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €65.00 |
| concierge | €351.82 |
| electricity_usage | €44.00 |

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
