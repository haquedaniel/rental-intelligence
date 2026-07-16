# Pilotys pricing calendar validation v10

Fixes publication validation for minimum stays greater than one night.

- Reads back the exact Beds24 calendar override (`price1`, `minStay`).
- Queries the traveller offer over the configured minimum-stay length only as a secondary check.
- An explicit `--date` can reconcile a prior `validation_failed` action.
- If the exact override is already present, it is validated and marked applied without another write.
