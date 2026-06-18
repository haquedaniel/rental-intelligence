
#!/usr/bin/env bash
set -euo pipefail

cd /opt/rental-intelligence
mkdir -p logs

exec 9>/tmp/rental_intelligence_cockpit_refresh.lock
if ! flock -n 9; then
  echo "===== $(date -Is) cockpit_refresh already running; exiting ====="
  exit 0
fi

run_required() {
  echo
  echo "===== $(date -Is) running $* ====="
  docker compose exec -T cockpit "$@"
}

run_optional() {
  echo
  echo "===== $(date -Is) optional: $* ====="
  if ! docker compose exec -T cockpit "$@"; then
    echo "===== $(date -Is) WARNING optional step failed: $* ====="
  fi
}

echo "===== $(date -Is) starting cockpit_refresh ====="

# Core booking / financial refresh
run_required python -m rental_intel.scripts.extract_bookings
run_required python -m rental_intel.scripts.build_metrics
run_required python -m rental_intel.scripts.build_profitability
run_required python -m rental_intel.scripts.build_portfolio_profitability
run_required python -m rental_intel.scripts.build_variable_period_costs
run_required python -m rental_intel.scripts.build_financial_views
run_required python -m rental_intel.scripts.build_price_floors
run_required python -m rental_intel.scripts.build_dashboard_kpis

# Availability / forward-looking cockpit data
run_optional python -m rental_intel.scripts.extract_availability
run_optional python -m rental_intel.scripts.extract_gap_offers
run_optional python -m rental_intel.scripts.build_forward_position

# Recommendations are useful but should not kill the refresh
if docker compose exec -T cockpit test -f /app/outputs/processed/future_offers.csv; then
  run_optional python -m rental_intel.scripts.build_recommendations
else
  echo "===== $(date -Is) skipping build_recommendations: missing /app/outputs/processed/future_offers.csv ====="
fi

run_optional python -m rental_intel.scripts.build_data_quality_report

# Refresh Streamlit app process
echo
echo "===== $(date -Is) restarting cockpit container ====="
docker compose restart cockpit

echo "===== $(date -Is) cockpit_refresh complete ====="
