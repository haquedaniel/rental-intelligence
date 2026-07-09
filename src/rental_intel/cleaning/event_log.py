from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, dict):
        return {
            str(key): _jsonable(item)
            for key, item in value.items()
            if item is not None
        }

    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]

    return value


def _clean(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: _jsonable(value)
        for key, value in payload.items()
        if value is not None
    }


def log_operational_event(
    supabase,
    *,
    event_type: str,
    severity: str = "info",
    source: str = "python",
    actor_type: str | None = None,
    actor_id: str | None = None,
    job_name: str | None = None,
    run_id: str | None = None,
    property_id: str | None = None,
    reservation_id: str | None = None,
    cleaning_request_id: str | None = None,
    cleaner_id: str | None = None,
    owner_id: str | None = None,
    cleaning_profile_id: str | None = None,
    status_before: str | None = None,
    status_after: str | None = None,
    reason_code: str | None = None,
    reason: str | None = None,
    title: str | None = None,
    summary: str | None = None,
    event_key: str | None = None,
    old_data: dict[str, Any] | None = None,
    new_data: dict[str, Any] | None = None,
    context: dict[str, Any] | None = None,
) -> bool:
    """
    Best-effort operational audit log.

    It must never break mission creation. If the log table is missing or an
    insert fails, we print a warning and return False.
    """
    try:
        if event_key:
          existing = (
              supabase.table("operational_event_log")
              .select("id")
              .eq("event_key", event_key)
              .limit(1)
              .execute()
          )

          if existing.data:
              return False

        payload = _clean({
          "event_type": event_type,
          "severity": severity,
          "source": source,
          "actor_type": actor_type,
          "actor_id": actor_id,
          "job_name": job_name,
          "run_id": run_id,
          "property_id": property_id,
          "reservation_id": reservation_id,
          "cleaning_request_id": cleaning_request_id,
          "cleaner_id": cleaner_id,
          "owner_id": owner_id,
          "cleaning_profile_id": cleaning_profile_id,
          "status_before": status_before,
          "status_after": status_after,
          "reason_code": reason_code,
          "reason": reason,
          "title": title,
          "summary": summary,
          "event_key": event_key,
          "old_data": old_data,
          "new_data": new_data,
          "context": context,
      })

        supabase.table("operational_event_log").insert(payload).execute()
        return True

    except Exception as exc:
        print(f"WARN operational_event_log failed for {event_type}: {exc}")
        return False
