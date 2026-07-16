#!/usr/bin/env bash

OPS_SCRIPT_NAME="${OPS_SCRIPT_NAME:-unknown_script}"
OPS_RUN_ID="${OPS_RUN_ID:-$(date -u +"%Y%m%dT%H%M%SZ")-$$}"
OPS_EVENT_COMPLETED="${OPS_EVENT_COMPLETED:-0}"

ops_event_log() {
  local event_type="$1"
  local severity="$2"
  local title="$3"
  local summary="${4:-}"
  local reason_code="${5:-}"

  # Operational logging must never block the actual cron job.
  # Close stdin explicitly and cap the whole docker invocation at 5 seconds.
  timeout --signal=KILL 5s docker compose exec -T cockpit \
    python -m rental_intel.ops.log_event \
      --event-type "$event_type" \
      --severity "$severity" \
      --source "cron_script" \
      --job-name "$OPS_SCRIPT_NAME" \
      --run-id "$OPS_RUN_ID" \
      --title "$title" \
      --summary "$summary" \
      --reason-code "$reason_code" \
    </dev/null >/dev/null 2>&1 || true
}

ops_event_start() {
  ops_event_log "${OPS_SCRIPT_NAME}_started" "info" "${OPS_SCRIPT_NAME} started" "Cron/script run started." "started"
}

ops_event_skipped() {
  local summary="${1:-Skipped.}"
  ops_event_log "${OPS_SCRIPT_NAME}_skipped" "info" "${OPS_SCRIPT_NAME} skipped" "$summary" "skipped"
}

ops_event_step_failed() {
  local summary="${1:-Optional step failed.}"
  ops_event_log "${OPS_SCRIPT_NAME}_step_failed" "warning" "${OPS_SCRIPT_NAME} optional step failed" "$summary" "step_failed"
}

ops_event_mark_complete() {
  OPS_EVENT_COMPLETED=1
  ops_event_log "${OPS_SCRIPT_NAME}_completed" "info" "${OPS_SCRIPT_NAME} completed" "Cron/script run completed successfully." "completed"
}

ops_event_exit_trap() {
  local status="$?"

  if [ "${OPS_EVENT_COMPLETED:-0}" = "1" ]; then
    return "$status"
  fi

  if [ "$status" -eq 0 ]; then
    ops_event_log "${OPS_SCRIPT_NAME}_completed" "info" "${OPS_SCRIPT_NAME} completed" "Cron/script run completed successfully." "completed"
  else
    ops_event_log "${OPS_SCRIPT_NAME}_failed" "critical" "${OPS_SCRIPT_NAME} failed" "Cron/script exited with status $status." "failed"
  fi

  return "$status"
}

ops_event_install_trap() {
  trap ops_event_exit_trap EXIT
}
