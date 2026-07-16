# Pilotys automatic pricing publication v8

Pilotys remains authoritative. When a property is set to **En direct**, changed available dates are queued automatically. The publisher reads the current active Pilotys target immediately before each write, sends it through the channel manager, performs a fresh one-night traveller quote, and marks the date live only when validation succeeds.

## Safety model

- Preview mode never publishes.
- Paused live mode keeps changes queued.
- Only targets matching the active calendar version can publish.
- Occupied dates are never published.
- Unchanged validated dates are not republished by the daily run.
- Transient failures retry with backoff, up to five attempts.
- Quote mismatches fail closed and require review/retry.
- Each action retains the offer before, payload, write response, and offer after.

## Install

```bash
bash pilotys-pricing-automatic-publication-v8/install.sh
supabase db push
docker compose up -d --build
```

On the server install the schedules:

```bash
sudo bash scripts/install_pricing_cron.sh
```

This runs daily recalculation at 04:15 server time and drains changed live prices every ten minutes in batches of 30. Override with `PRICING_PUBLICATION_LIMIT`.

## Controlled activation

Keep the property in **Aperçu Pilotys**, then dry-run:

```bash
docker compose exec -T cockpit python -m rental_intel.scripts.publish_pricing --property-id PROPERTY_UUID --limit 5 --dry-run
```

Switch the property to **En direct** in the UI. Saving recalculates and queues changes. For an immediate first test instead of waiting for cron:

```bash
docker compose exec -T cockpit python -m rental_intel.scripts.publish_pricing --property-id PROPERTY_UUID --limit 1
```

Thereafter no owner publication button is required. The UI provides normal preview/live selection and an emergency pause. Failed actions can be reset administratively:

```bash
docker compose exec -T cockpit python -m rental_intel.scripts.publish_pricing --property-id PROPERTY_UUID --retry-failed --limit 1
```
