Pilotys pricing recovery repair v2

Fixes:
1. Summer/season rows are labelled season_plan instead of base_plan.
2. Manual overrides are labelled manual_override unless superseded by a stronger optimisation.
3. Pending daily prices recreate missing publication actions after an interrupted run.
4. Matching open actions are reused, stale proposed actions are superseded, and applying actions are not raced.
5. Successfully published targets remain published across regeneration; changed targets clear stale publication metadata.

Install from the rental-intelligence repository root:
  bash pilotys-pricing-recovery-repair-v2/install-pricing-recovery-repair.sh
