#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence
mkdir -p logs

exec 9>/tmp/rental_intelligence_market_refresh.lock
if ! flock -n 9; then
  echo "===== $(date -Is) market_refresh already running; exiting ====="
  exit 0
fi

run_optional() {
  echo
  echo "===== $(date -Is) running $* ====="
  if ! docker compose exec -T cockpit "$@"; then
    echo "WARNING: optional step failed: $*"
  fi
}

echo "===== $(date -Is) starting market_refresh ====="

run_optional python -m rental_intel.scripts.build_market_jobs
run_optional python -m rental_intel.scripts.extract_own_price_scenarios
run_optional python -m rental_intel.scripts.extract_market_thais_prices

# Heavier / more fragile than own prices and Le Goyen.
# Keep this daily, not hourly.
run_optional python -m rental_intel.scripts.extract_market_airbnb_prices

run_optional python -m rental_intel.scripts.build_market_benchmark

echo
echo "===== $(date -Is) market outputs after refresh ====="
docker compose exec -T cockpit bash -lc '
cd /app
for p in \
  outputs/processed/market_probe_jobs.csv \
  outputs/processed/own_price_scenarios.csv \
  outputs/processed/market_price_snapshots_latest.csv \
  outputs/processed/market_daily_price_snapshots_latest.csv \
  outputs/processed/market_benchmark_latest.csv
do
  if [ -e "$p" ]; then
    stat -c "%y  %s bytes  %n" "$p"
  else
    echo "MISSING  $p"
  fi
done
'

echo "===== $(date -Is) market_refresh complete ====="
