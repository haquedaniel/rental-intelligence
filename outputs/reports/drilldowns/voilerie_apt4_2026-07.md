# Profitability drill-down — voilerie / apt4 / 2026-07

## Summary

| Metric | Amount |
|---|---:|
| Gross booking value | €3 776.26 |
| Accommodation revenue | €3 540.00 |
| Cleaning fee charged to guest | €236.24 |
| Tourist tax | €133.97 |
| Channel commission | €135.94 |
| Host payout | €3 640.30 |
| Host payout less cleaning charged | €3 404.06 |
| Booking-associated costs | €1 443.37 |
| Fixed allocated costs | €415.71 |
| Estimated operating profit | €1 781.22 |

## Booking revenue detail

| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 87590765 | airbnb | 2026-07-30 | 2026-08-07 | 8 | €1 206.40 | €105.00 | €66.35 | €47.21 | €1 264.19 | HME4RW34MK |
| 87590764 | airbnb | 2026-07-22 | 2026-07-30 | 8 | €1 177.60 | €105.00 | €32.38 | €46.18 | €1 236.42 | HMAS8X5BNF |
| 87590763 | airbnb | 2026-07-08 | 2026-07-22 | 14 | €2 060.80 | €105.00 | €85.01 | €77.96 | €2 087.84 | HMFCZYM4FW |

## Booking-associated expense detail

| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |
|---|---|---|---|---|---:|---|---:|
| 87590765 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-30 | 8 | airbnb | €289.80 |
| 87590765 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-07-30 | 8 | airbnb | €85.00 |
| 87590765 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-30 | 8 | airbnb | €32.00 |
| 87590764 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-22 | 8 | airbnb | €282.86 |
| 87590764 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-07-22 | 8 | airbnb | €85.00 |
| 87590764 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-22 | 8 | airbnb | €32.00 |
| 87590763 | concierge | concierge_voilerie_ota_until_sep_2026 | percentage_of_host_payout_minus_cleaning | 2026-07-08 | 14 | airbnb | €495.71 |
| 87590763 | cleaning_actual_cost | cleaning_actual_apt4 | fixed_per_booking | 2026-07-08 | 14 | airbnb | €85.00 |
| 87590763 | electricity_usage | electricity_usage_all | fixed_per_night | 2026-07-08 | 14 | airbnb | €56.00 |

### Booking-associated expense totals

| Category | Amount |
|---|---:|
| cleaning_actual_cost | €255.00 |
| concierge | €1 068.37 |
| electricity_usage | €120.00 |

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
