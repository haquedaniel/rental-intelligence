# Pilotys owner decisions & briefings v1

Owner-scoped activity feed and deterministic SMS briefings across one or many properties.

## Install
```bash
bash pilotys-owner-decisions-briefings-v1/install.sh
supabase db push
docker compose up -d --build cockpit cleaner-web
sudo bash scripts/install_owner_briefings_cron.sh
```

## First backfill/test
```bash
docker compose exec -T cockpit python -m rental_intel.scripts.sync_ops_decisions
docker compose exec -T cockpit python -m rental_intel.scripts.generate_owner_briefings --owner-id OWNER_UUID
```
Then open `/owner/<ownerToken>/activity`.

SMS is enqueued into the existing `outbound_messages` table and delivered by the existing Twilio sender. Set preferences in the owner Activity page. The cron runs every ten minutes, but morning/evening/daily/weekly preferences suppress delivery until due.
