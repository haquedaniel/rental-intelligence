# Pilotys pricing curves and UI v5

Adds visual curve presets, season-level inheritance/custom/no-reduction behaviour, a clearer grouped pricing UI, editable seasons, and pending/completed recalculation feedback.

Install from repository root:

```bash
bash pilotys-pricing-curves-ui-v5/install.sh
supabase db push
docker compose up -d --build
```

The property and season curve JSON remains authoritative. The preset/horizon/max columns only preserve the human-friendly selection.
