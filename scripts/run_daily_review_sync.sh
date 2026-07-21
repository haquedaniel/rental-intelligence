#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence

echo "=== Review sync started: $(date --iso-8601=seconds) ==="

docker compose exec -T cockpit \
  python scripts/sync_airbnb_reviews.py

docker compose exec -T cockpit \
  python scripts/snapshot_review_ratings.py

echo "=== Review sync finished: $(date --iso-8601=seconds) ==="
