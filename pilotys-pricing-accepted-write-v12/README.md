# Pilotys pricing publication v12

Simplifies publication success semantics:

- A current action is applied when Beds24 explicitly returns `success: true`.
- Calendar GET and offer quotes are no longer pass/fail validators.
- A previously preserved successful write response is reconciled without rewriting.
- Published target price/minimum stay are recorded in `pricing_daily_prices`.
- Concrete API failures, stale actions, occupied nights, disabled/live-paused properties still fail closed.

No migration or frontend rebuild is required.
