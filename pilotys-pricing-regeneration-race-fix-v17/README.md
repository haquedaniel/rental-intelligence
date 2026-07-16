# Pilotys pricing regeneration race fix v17

Prevents a concurrent publication action from aborting a full calendar regeneration.

- Existing `applying` actions are left untouched.
- Their dates are deferred until a later regeneration if still necessary.
- Unique-conflict races are skipped per date rather than aborting the whole batch.
- Regeneration output reports deferred/conflicting action counts.
