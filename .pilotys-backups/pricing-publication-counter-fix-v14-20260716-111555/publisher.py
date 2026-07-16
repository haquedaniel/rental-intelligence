from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


@dataclass
class PublicationSummary:
    selected: int = 0
    applied: int = 0
    stale: int = 0
    failed: int = 0
    validation_failed: int = 0
    skipped: int = 0
    reconciled: int = 0

    def as_dict(self) -> dict[str, int]:
        return self.__dict__.copy()


def _money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _source_link(db, property_id: str) -> tuple[int, int]:
    rows = (
        db.table("property_source_links")
        .select("source_property_id,source_room_id")
        .eq("property_id", property_id)
        .eq("source_system", "beds24")
        .eq("active", True)
        .execute()
        .data
        or []
    )
    if not rows:
        raise RuntimeError(f"No active channel source link for property {property_id}")
    return int(rows[0]["source_property_id"]), int(rows[0]["source_room_id"])


def _extract_total(response: Any) -> float | None:
    """Extract a one-night effective room price from the account's offer response.

    The existing live proof used one-night offers whose effective total equals price1.
    We retain the complete raw response for audit and fail closed if no unambiguous
    numeric price can be found.
    """
    preferred = ("price", "totalPrice", "priceTotal", "total")

    def walk(value: Any) -> float | None:
        if isinstance(value, dict):
            for key in preferred:
                candidate = value.get(key)
                if isinstance(candidate, (int, float)):
                    return float(candidate)
            for nested in value.values():
                found = walk(nested)
                if found is not None:
                    return found
        elif isinstance(value, list):
            for nested in value:
                found = walk(nested)
                if found is not None:
                    return found
        return None

    return walk(response)




def _explicit_success(response: Any) -> bool:
    """Return True only when the channel response contains explicit success=true.

    Beds24 calendar writes have returned both dictionaries and lists of
    dictionaries in this account. Any explicit success=false fails the write; at
    least one explicit success=true is required.
    """
    seen_true = False

    def walk(value: Any) -> bool:
        nonlocal seen_true
        if isinstance(value, dict):
            if "success" in value:
                if value.get("success") is False:
                    return False
                if value.get("success") is True:
                    seen_true = True
            # Explicit API errors always win over a success elsewhere.
            if value.get("error") not in (None, "", False, []):
                return False
            for nested in value.values():
                if not walk(nested):
                    return False
        elif isinstance(value, list):
            for nested in value:
                if not walk(nested):
                    return False
        return True

    return walk(response) and seen_true


def _prior_write_response(action_response: Any) -> Any | None:
    """Return a preserved successful write response from an earlier attempt."""
    if isinstance(action_response, dict):
        candidate = action_response.get("write")
        if _explicit_success(candidate):
            return candidate
    return None



def _extract_calendar_override(response: Any, target_date: str) -> tuple[float | None, int | None]:
    """Find the explicit calendar override written for one date.

    Beds24 calendar responses can be wrapped in data/room/calendar objects and
    have varied slightly across API versions.  We deliberately search only rows
    that cover target_date and only return explicit price1/minStay values.
    """
    target = date.fromisoformat(target_date)
    matches: list[dict[str, Any]] = []

    def covers(row: dict[str, Any]) -> bool:
        raw_from = row.get("from") or row.get("date")
        raw_to = row.get("to") or raw_from
        if not raw_from:
            return False
        try:
            start = date.fromisoformat(str(raw_from)[:10])
            end = date.fromisoformat(str(raw_to)[:10])
        except ValueError:
            return False
        return start <= target <= end

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if covers(value) and ("price1" in value or "minStay" in value):
                matches.append(value)
            for nested in value.values():
                walk(nested)
        elif isinstance(value, list):
            for nested in value:
                walk(nested)

    walk(response)
    if not matches:
        return None, None
    # Prefer the most specific row (single date) when ranges overlap.
    row = matches[-1]
    price = row.get("price1")
    min_stay = row.get("minStay")
    return (float(price) if isinstance(price, (int, float)) else None,
            int(min_stay) if isinstance(min_stay, (int, float)) else None)


def _get_calendar_override(client: Beds24Client, room_id: int, day: date) -> tuple[dict[str, Any], float | None, int | None]:
    response = client.get(
        "/inventory/rooms/calendar",
        params={"roomId": room_id, "from": day.isoformat(), "to": day.isoformat()},
    )
    price, min_stay = _extract_calendar_override(response, day.isoformat())
    return response, price, min_stay


def _offer_for_minimum_stay(
    client: Beds24Client, *, property_id: int, room_id: int, day: date, min_stay: int
) -> dict[str, Any]:
    departure = day + timedelta(days=max(1, min_stay))
    return client.get_offers(
        property_id=property_id,
        room_id=room_id,
        arrival=day.isoformat(),
        departure=departure.isoformat(),
        num_adults=2,
        num_children=0,
    )


def _retry_delay(attempt: int) -> timedelta:
    # 5, 15, 45, 120 minutes, then six hours.
    minutes = [5, 15, 45, 120, 360][min(max(attempt - 1, 0), 4)]
    return timedelta(minutes=minutes)


def _load_action_context(db, action: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    setting = (
        db.table("pricing_property_settings")
        .select("property_id,enabled,mode,publication_paused")
        .eq("property_id", action["property_id"])
        .maybe_single()
        .execute()
        .data
    )
    daily = (
        db.table("pricing_daily_prices")
        .select("property_id,date,available,final_price,min_stay,calendar_version_id,publication_status")
        .eq("property_id", action["property_id"])
        .eq("date", action["date"])
        .maybe_single()
        .execute()
        .data
    )
    if not setting or not daily:
        raise RuntimeError("Missing current pricing settings or daily target")
    return setting, daily


def _is_current(action: dict[str, Any], daily: dict[str, Any]) -> bool:
    # Publication payloads are normally Beds24 request arrays. Some earlier
    # engine versions also stored metadata dictionaries. Only dictionaries can
    # carry calendar_version_id; list payloads remain valid and are checked
    # against the current daily target through price, minimum stay and availability.
    raw_payload = action.get("payload")
    payload_meta = raw_payload if isinstance(raw_payload, dict) else {}
    payload_calendar_version_id = payload_meta.get("calendar_version_id")

    return (
        bool(daily.get("available"))
        and _money(daily.get("final_price")) == _money(action.get("target_price"))
        and int(daily.get("min_stay") or 1) == int(action.get("target_min_stay") or 1)
        and (
            not payload_calendar_version_id
            or str(payload_calendar_version_id) == str(daily.get("calendar_version_id"))
        )
    )


def publish_pending(
    property_id: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
    target_date: str | None = None,
) -> PublicationSummary:
    db = get_supabase_client()
    now = datetime.now(timezone.utc)
    max_attempts = int(os.getenv("PRICING_PUBLICATION_MAX_ATTEMPTS", "5"))
    batch_limit = limit or int(os.getenv("PRICING_PUBLICATION_LIMIT", "30"))

    eligible_statuses = ["proposed", "failed"]
    # An explicitly requested date may be reconciled after a previous validation
    # failure. Automatic runs still leave validation_failed actions for review.
    if target_date:
        eligible_statuses.append("validation_failed")

    q = (
        db.table("pricing_publication_actions")
        .select("*")
        .in_("status", eligible_statuses)
        .eq("mode", "apply")
        .order("date")
        .order("created_at")
        .limit(batch_limit * 3)
    )
    if property_id:
        q = q.eq("property_id", property_id)
    if target_date:
        # Validate early so a typo cannot silently select unrelated dates.
        date.fromisoformat(target_date)
        q = q.eq("date", target_date)
    candidates = q.execute().data or []
    actions = [
        a for a in candidates
        if (target_date or int(a.get("attempt_count") or 0) < max_attempts)
        and (target_date or not a.get("next_attempt_at") or datetime.fromisoformat(str(a["next_attempt_at"]).replace("Z", "+00:00")) <= now)
    ][:batch_limit]

    if target_date and not actions:
        raise RuntimeError(
            f"No eligible current publication action for {target_date}. "
            "The night may be occupied, already published, paused, stale, or not queued."
        )

    summary = PublicationSummary(selected=len(actions))
    client = None if dry_run else Beds24Client()

    touched_properties: set[str] = set()
    for action in actions:
        action_id = action["id"]
        property_key = str(action["property_id"])
        touched_properties.add(property_key)
        attempt = int(action.get("attempt_count") or 0) + 1
        try:
            setting, daily = _load_action_context(db, action)
            if not setting.get("enabled") or setting.get("mode") != "apply" or setting.get("publication_paused"):
                summary.skipped += 1
                continue
            if not _is_current(action, daily):
                db.table("pricing_publication_actions").update({
                    "status": "superseded",
                    "updated_at": now.isoformat(),
                    "error": "Target no longer matches the active Pilotys calendar.",
                }).eq("id", action_id).execute()
                summary.stale += 1
                continue

            source_property_id, room_id = _source_link(db, property_key)
            day = date.fromisoformat(str(action["date"]))
            target_price = _money(action["target_price"])
            target_min_stay = int(action["target_min_stay"])
            payload = [{
                "roomId": room_id,
                "calendar": [{
                    "from": day.isoformat(),
                    "to": day.isoformat(),
                    "price1": float(target_price),
                    "minStay": target_min_stay,
                }],
            }]

            if dry_run:
                print({"action_id": action_id, "payload": payload})
                continue

            db.table("pricing_publication_actions").update({
                "status": "applying",
                "attempt_count": attempt,
                "last_attempt_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "error": None,
            }).eq("id", action_id).execute()

            # If a previous attempt already received an explicit successful write
            # acknowledgement, reconcile it locally rather than sending the same
            # payload again. This repairs earlier false validation failures.
            prior_write = _prior_write_response(action.get("response"))
            reconciled = prior_write is not None

            # A user may save a newer Pilotys version while this run is in progress.
            # Re-check immediately before the external write and fail closed if stale.
            latest_setting, latest_daily = _load_action_context(db, action)
            if latest_setting.get("mode") != "apply" or latest_setting.get("publication_paused") or not _is_current(action, latest_daily):
                db.table("pricing_publication_actions").update({
                    "status": "superseded",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "error": "Target changed before external publication.",
                }).eq("id", action_id).execute()
                summary.stale += 1
                continue

            write_response: Any = prior_write
            if write_response is None:
                write_response = client.post("/inventory/rooms/calendar", json_data=payload)

            if not _explicit_success(write_response):
                raise RuntimeError(f"Channel rejected pricing write: {write_response!r}")

            completed = datetime.now(timezone.utc)
            response_payload = {
                "write": write_response,
                "acceptance": {
                    "accepted": True,
                    "basis": "explicit_api_success",
                    "reconciled_from_previous_attempt": reconciled,
                },
            }
            db.table("pricing_publication_actions").update({
                "status": "applied",
                "payload": payload,
                "response": response_payload,
                "effective_price_after": float(target_price),
                "validation_status": "accepted_by_channel",
                "applied_at": completed.isoformat(),
                "updated_at": completed.isoformat(),
                "next_attempt_at": None,
                "error": None,
            }).eq("id", action_id).execute()
            db.table("pricing_daily_prices").update({
                "published_price": float(target_price),
                "published_min_stay": target_min_stay,
                "published_at": completed.isoformat(),
                "publication_status": "published",
            }).eq("property_id", property_key).eq("date", day.isoformat()).execute()
            summary.applied += 1
            if reconciled:
                summary.reconciled += 1
            if already_written:
                summary.reconciled += 1
        except Exception as exc:
            failed_at = datetime.now(timezone.utc)
            retry_at = failed_at + _retry_delay(attempt)
            status = "failed" if attempt < max_attempts else "validation_failed"
            db.table("pricing_publication_actions").update({
                "status": status,
                "attempt_count": attempt,
                "last_attempt_at": failed_at.isoformat(),
                "next_attempt_at": retry_at.isoformat() if status == "failed" else None,
                "updated_at": failed_at.isoformat(),
                "error": str(exc),
            }).eq("id", action_id).execute()
            db.table("pricing_daily_prices").update({"publication_status": "failed"}).eq("property_id", property_key).eq("date", action["date"]).execute()
            summary.failed += 1

    finished = datetime.now(timezone.utc)
    for pid in touched_properties:
        update: dict[str, Any] = {"publication_last_run_at": finished.isoformat()}
        if summary.failed or summary.validation_failed:
            update["publication_last_error"] = f"{summary.failed + summary.validation_failed} publication error(s) in latest run."
        else:
            update["publication_last_success_at"] = finished.isoformat()
            update["publication_last_error"] = None
        db.table("pricing_property_settings").update(update).eq("property_id", pid).execute()

    return summary


def retry_failed(property_id: str) -> int:
    db = get_supabase_client()
    rows = (
        db.table("pricing_publication_actions")
        .select("id")
        .eq("property_id", property_id)
        .in_("status", ["failed", "validation_failed"])
        .execute()
        .data
        or []
    )
    if rows:
        ids = [row["id"] for row in rows]
        db.table("pricing_publication_actions").update({
            "status": "proposed",
            "attempt_count": 0,
            "next_attempt_at": None,
            "validation_status": None,
            "error": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).in_("id", ids).execute()
    return len(rows)


def publish(
    property_id: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
    target_date: str | None = None,
) -> PublicationSummary:
    """Backward-compatible alias for older pricing package imports."""
    return publish_pending(
        property_id=property_id,
        limit=limit,
        dry_run=dry_run,
        target_date=target_date,
    )
