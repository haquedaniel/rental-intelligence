# Owner App Mobile v2 — payment query hotfix

Fixes the owner page server error caused by selecting nonexistent
`monthly_payment_requests.period_label` and `monthly_payment_requests.month`
columns.

The query now uses the actual `period_start` and `period_end` columns and
formats the payment period in French.

Apply this after `pilotys-owner-app-mobile-v2`.
