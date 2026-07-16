# Pilotys owner decisions payload fix v2

Fixes decision synchronization when `pricing_publication_actions.payload`
contains the raw Beds24 request list rather than the original metadata object.

Pricing actions are associated with a calendar version by:
1. explicit `calendar_version_id` when still available;
2. otherwise, the action creation-time window before the property's next
   calendar version.
