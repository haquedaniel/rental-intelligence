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

# Sync analytics CSV outputs to Supabase for the Next.js owner cockpit
echo
echo "===== $(date -Is) syncing analytics CSVs to Supabase ====="
run_optional python -m rental_intel.analytics.sync_csv_to_supabase

# Refresh Streamlit app process
echo
echo "===== $(date -Is) restarting cockpit container ====="
docker compose restart cockpit

echo "===== $(date -Is) cockpit_refresh complete ====="