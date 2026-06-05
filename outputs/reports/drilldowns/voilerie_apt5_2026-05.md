# Profitability drill-down — voilerie / apt5 / 2026-05

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €360.00 |
| Accommodation revenue | €230.00 |
| Cleaning fee charged to guest | €130.00 |
| Tourist tax | €10.64 |
| Channel commission | €12.96 |
| Host payout | €347.04 |
| Host payout less cleaning charged | €217.04 |
| Booking-associated costs | €200.26 |
| Fixed allocated costs | €347.71 |
| Estimated operating profit | €-200.93 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87549000 | airbnb | 2026-05-23 | 2026-05-25 | 2 | €110.00 | €65.00 | €4.04 | €6.30 | €168.70 | HM2MPZWSYD |
| 87548999 | airbnb | 2026-05-08 | 2026-05-10 | 2 | €120.00 | €65.00 | €6.60 | €6.66 | €178.34 | HMK9Q39YTA |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87549000 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-05-23 | 2 | airbnb | €25.92 |
| 87549000 | cleaning_actual_cost | cleaning_actual_apt5 | fixed_per_booking | 2026-05-23 | 2 | airbnb | €65.00 |
| 87549000 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-05-23 | 2 | airbnb | €8.00 |
| 87548999 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-05-08 | 2 | airbnb | €28.34 |
| 87548999 | cleaning_actual_cost | cleaning_actual_apt5 | fixed_per_booking | 2026-05-08 | 2 | airbnb | €65.00 |
| 87548999 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-05-08 | 2 | airbnb | €8.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €130.00 |
| concierge | €54.26 |
| electricity_usage | €16.00 |

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
