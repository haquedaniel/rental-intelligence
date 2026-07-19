# Reservation cleaning-cost attribution hotfix

Fixes the reservation profitability card incorrectly summing both:

1. the cleaning mission that prepared the stay; and
2. the cleaning mission after the stay.

Only the checkout mission is now attributed to the reservation's cleaning
cost. The operational section continues to show both related missions.

This is a display/calculation fix in the Next.js page. It does not modify
database records.
