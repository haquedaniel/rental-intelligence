# Pilotys pricing UI + owner journal corrective v4

Built against the supplied `rental-intelligence-current(1).zip` source tree.

## Fixes

### €100 shown instead of €90

The settings form uses uncontrolled inputs (`defaultValue`). Next.js client-side navigation can preserve the mounted form when switching property or receiving refreshed server data, leaving the previous property's value visible. The form is now keyed by property ID and `settings.updated_at`, forcing it to remount from the row actually loaded from `pricing_property_settings`. Season editors receive the same protection.

No pricing-engine calculation is changed.

### Manual configuration vs automatic pricing

`sync.py` now records pricing provenance from `pricing_configuration_versions.created_by`:

- `owner_configuration`
- `admin_configuration`
- `automatic_pricing`

Historical decisions without this metadata are resolved through their calendar/configuration version when situations are rebuilt.

Manual configuration recalculations are omitted from the owner Journal. Automatic pricing sessions receive one situation per calendar version rather than being merged forever under `pricing:<property>:latest`.

### Explainability

Automatic pricing situations include:

- exact date range;
- affected dates;
- final prices when the relevant calendar version is still materialised;
- temporal and market influence counts based on stored daily-price evidence.

### Briefing delivery

Preview briefings remain non-destructive. A real scheduled briefing can recover recent situations that were never included in a genuine queued/sent briefing. Dismissed legacy pricing stories are excluded.

## Install

From the repository root:

```bash
bash pilotys-pricing-ui-journal-corrective-v4/install.sh
supabase db push
docker compose up -d --build cockpit cleaner-web
docker compose exec -T cockpit python -m rental_intel.scripts.build_ops_situations
```

## Validation performed

The three Python files pass `python -m py_compile`. Frontend lint/typecheck could not be executed in the isolated build environment because npm dependencies were not present and installation did not complete within the available execution window.
