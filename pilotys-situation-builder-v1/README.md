# Pilotys situation builder v1

This is the first step of the plain-language property-manager layer.

It does not change:
- the pricing engine;
- current SMS generation;
- the existing Activity page.

It creates `ops_situations` from raw `ops_decisions` and groups repeated pricing
recalculations into one current story per property.

Run:

```bash
supabase db push
docker compose up -d --build cockpit
docker compose exec -T cockpit python -m rental_intel.scripts.build_ops_situations
```

Then inspect:

```sql
select
  headline,
  situation_text,
  explanation_text,
  action_text,
  next_step_text,
  last_observed_at
from public.ops_situations
order by last_observed_at desc;
```
