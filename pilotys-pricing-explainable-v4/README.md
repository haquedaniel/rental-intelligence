# Pilotys explainable pricing v4

This package adds persisted configuration/calendar versions, Cancel vs Rollback,
an explainable monthly calendar, a relative Le Goyen signal, and a tiny internal
Python regeneration API. It does **not** publish to Beds24.

## Install

```bash
bash pilotys-pricing-explainable-v4/install.sh
supabase db push
docker compose up -d --build
```

The installer adds `docker-compose.pricing.yml` to `COMPOSE_FILE` in `.env` and
creates `PRICING_INTERNAL_SECRET` if missing.

## Meanings

- **Annuler les modifications**: resets unsaved browser form edits only.
- **Enregistrer et recalculer**: persists settings, creates a configuration
  version and calendar version, then recalculates through Python.
- **Rollback**: restores an earlier configuration snapshot as a new version and
  recalculates. History is never deleted.
- Beds24 remains untouched because every setting is forced to `mode=shadow`.

## Le Goyen

The hotel price is never used as an absolute apartment price. Each date is
compared with Le Goyen's own median for the same weekday within +/-35 days.
Only that exceptional percentage movement can influence the Pilotys plan.
Influence defaults to 0% and must be explicitly enabled.
