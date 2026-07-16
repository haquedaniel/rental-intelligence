# Pilotys pricing temporality fix v6

- Python reconstructs curves from preset/horizon/max-discount metadata, so temporal pricing does not depend on stale or missing JSON.
- General and season curves apply immediately according to days before arrival.
- Season choices are only inherit or override.
- Flat-line “Prix maintenu” is the sole no-degressivity option.
- Existing seasons are expanded; the new-season editor is collapsed and shown last.
