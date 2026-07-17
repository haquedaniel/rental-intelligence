from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from rental_intel.cleaning.db import get_supabase_client


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def due(pref: dict[str, Any], now: datetime) -> bool:
    if not pref.get("enabled"):
        return False
    tz = ZoneInfo(pref.get("timezone") or "Europe/Paris")
    local = now.astimezone(tz)
    lastdt = _parse_dt(pref.get("last_briefing_at"))
    if lastdt:
        lastdt = lastdt.astimezone(tz)
    freq = pref.get("frequency") or "morning"
    hour = int(pref.get("delivery_hour") or 8)
    if freq == "immediate":
        return True
    if local.hour < hour:
        return False
    if freq in ("morning", "evening", "daily"):
        return not lastdt or lastdt.date() < local.date()
    return local.weekday() == int(pref.get("weekly_day") or 1) and (
        not lastdt or (local.date() - lastdt.date()).days >= 6
    )


def allowed(decision: dict[str, Any], pref: dict[str, Any]) -> bool:
    decision_type = decision.get("decision_type", "")
    mapping = {
        "reservation_created": "include_reservations",
        "reservation_modified": "include_reservations",
        "reservation_cancelled": "include_reservations",
        "cleaning_completed": "include_cleaning_completed",
        "cleaner_accepted": "include_cleaner_accepted",
        "cleaner_refused": "include_cleaner_refused",
        "cleaning_rescheduled": "include_cleaning_rescheduled",
        "pricing_session": "include_pricing",
        "minimum_stay_session": "include_min_stay",
    }
    preference_field = mapping.get(decision_type)
    if preference_field and not pref.get(preference_field, True):
        return False

    included_property_ids = pref.get("included_property_ids") or []
    if included_property_ids and decision.get("property_id") not in included_property_ids:
        return False

    if decision_type == "pricing_session":
        metadata = decision.get("metadata") or {}
        threshold_type = pref.get("pricing_threshold_type") or "pct"
        threshold = float(pref.get("pricing_threshold_value") or 0)
        metric = (
            abs(float(metadata.get("average_change_pct") or 0))
            if threshold_type == "pct"
            else abs(float(metadata.get("average_change_eur") or 0))
        )
        temporal = int(metadata.get("temporal_change_count") or 0) > 0
        if metric < threshold and not (pref.get("include_temporal_daily") and temporal):
            return False

    return True


def _owner_label(owner: dict[str, Any]) -> str:
    return owner.get("display_name") or owner.get("name") or "Propriétaire"


def _property_name(decision: dict[str, Any]) -> str:
    summary = str(decision.get("summary") or "")
    # Pricing summaries start with the property name followed by " · ".
    return summary.split(" · ", 1)[0] if " · " in summary else "Logement"


def _render_pricing(lines: list[str], pricing: list[dict[str, Any]]) -> None:
    """Collapse repeated recalculations to the latest state per property.

    A day can contain several recalculations (manual tuning, reservation refresh,
    cron). Earlier versions are superseded by later versions and should not be
    repeated as separate SMS bullets.
    """
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    minimum_stay_count = 0

    for decision in pricing:
        if decision.get("decision_type") == "minimum_stay_session":
            metadata = decision.get("metadata") or {}
            minimum_stay_count += int(metadata.get("change_count") or 0)
            continue
        if decision.get("decision_type") == "pricing_session":
            groups[str(decision.get("property_id") or _property_name(decision))].append(decision)

    for sessions in groups.values():
        sessions.sort(key=lambda row: str(row.get("occurred_at") or ""))
        latest = sessions[-1]
        metadata = latest.get("metadata") or {}
        changed_dates = int(metadata.get("changed_dates") or 0)
        avg_pct = float(metadata.get("average_change_pct") or 0)
        temporal_count = int(metadata.get("temporal_change_count") or 0)
        property_name = _property_name(latest)

        detail_bits = [f"{changed_dates} date(s)", f"moyenne {avg_pct:+.1f}%"]
        if temporal_count:
            detail_bits.append(f"{temporal_count} liée(s) à l’approche des séjours")
        if len(sessions) > 1:
            detail_bits.append(f"{len(sessions)} recalculs regroupés")

        lines.append(f"• Tarification — {property_name} : " + ", ".join(detail_bits) + ".")

    if minimum_stay_count:
        lines.append(
            f"• Séjours minimums : {minimum_stay_count} date(s) ajustée(s), "
            "notamment pour mieux utiliser les disponibilités courtes."
        )


def render(owner: dict[str, Any], decisions: list[dict[str, Any]]) -> str:
    lines = [f"Pilotys — {_owner_label(owner)}"]

    reservations = [d for d in decisions if d.get("category") == "reservation"]
    cleaning = [d for d in decisions if d.get("category") == "cleaning"]
    pricing = [d for d in decisions if d.get("category") == "pricing"]

    if reservations:
        counts: dict[str, int] = defaultdict(int)
        for decision in reservations:
            counts[str(decision.get("decision_type"))] += 1
        bits = []
        if counts["reservation_created"]:
            bits.append(f"{counts['reservation_created']} nouvelle(s)")
        if counts["reservation_modified"]:
            bits.append(f"{counts['reservation_modified']} modifiée(s)")
        if counts["reservation_cancelled"]:
            bits.append(f"{counts['reservation_cancelled']} annulée(s)")
        if bits:
            lines.append("• Réservations : " + ", ".join(bits) + ".")

    _render_pricing(lines, pricing)

    completed = sum(1 for d in cleaning if d.get("decision_type") == "cleaning_completed")
    accepted = sum(1 for d in cleaning if d.get("decision_type") == "cleaner_accepted")
    refused = sum(1 for d in cleaning if d.get("decision_type") == "cleaner_refused")
    rescheduled = sum(1 for d in cleaning if d.get("decision_type") == "cleaning_rescheduled")
    operation_bits = []
    if completed:
        operation_bits.append(f"{completed} mission(s) terminée(s)")
    if accepted:
        operation_bits.append(f"{accepted} acceptée(s)")
    if refused:
        operation_bits.append(f"{refused} refusée(s)")
    if rescheduled:
        operation_bits.append(f"{rescheduled} replanifiée(s)")
    if operation_bits:
        lines.append("• Opérations : " + ", ".join(operation_bits) + ".")

    requires_action = any(d.get("requires_owner_action") for d in decisions)
    lines.append(
        "Action requise : consultez Pilotys."
        if requires_action
        else "Aucune action requise."
    )
    return "\n".join(lines)


def _first_period_start(pref: dict[str, Any], now: datetime) -> datetime:
    """Avoid dumping the decision backfill into a newly-enabled owner's first SMS."""
    updated = _parse_dt(pref.get("updated_at"))
    recent_floor = now - timedelta(hours=6)
    if updated and updated > recent_floor:
        return updated
    return recent_floor


def _create_briefing(
    db: Any,
    *,
    pref: dict[str, Any],
    owner: dict[str, Any],
    now: datetime,
    period_start: datetime,
    queue_sms: bool,
    update_cursor: bool,
    frequency: str,
) -> dict[str, Any]:
    decisions = (
        db.table("ops_decisions")
        .select("*")
        .eq("owner_id", pref["owner_id"])
        .gt("occurred_at", period_start.isoformat())
        .lte("occurred_at", now.isoformat())
        .order("occurred_at")
        .execute()
        .data
        or []
    )
    decisions = [decision for decision in decisions if allowed(decision, pref)]

    body = (
        render(owner, decisions)
        if decisions
        else (
            f"Pilotys — {_owner_label(owner)}\n"
            "Aucun événement notable depuis le dernier briefing.\n"
            "Aucune action requise."
        )
    )
    status = "queued" if queue_sms else "generated"
    briefing = (
        db.table("ops_briefings")
        .insert(
            {
                "owner_id": pref["owner_id"],
                "period_start": period_start.isoformat(),
                "period_end": now.isoformat(),
                "frequency": frequency,
                "title": "Briefing Pilotys",
                "body": body,
                "decision_ids": [decision["id"] for decision in decisions],
                "decision_count": len(decisions),
                "requires_owner_action": any(
                    decision.get("requires_owner_action") for decision in decisions
                ),
                "status": status,
            }
        )
        .execute()
        .data[0]
    )

    recipients = []
    if queue_sms:
        recipients = [
            phone
            for phone in (
                pref.get("recipient_1_phone"),
                pref.get("recipient_2_phone"),
            )
            if phone
        ]
        for phone in dict.fromkeys(recipients):
            event_key = f"owner_briefing:{briefing['id']}:{phone}"
            message = (
                db.table("outbound_messages")
                .insert(
                    {
                        "owner_id": pref["owner_id"],
                        "channel": "sms",
                        "message_type": "owner_briefing",
                        "recipient_phone": phone,
                        "body": body,
                        "status": "pending",
                        "event_key": event_key,
                    }
                )
                .execute()
                .data[0]
            )
            db.table("ops_briefing_deliveries").insert(
                {
                    "briefing_id": briefing["id"],
                    "owner_id": pref["owner_id"],
                    "recipient": phone,
                    "outbound_message_id": message["id"],
                    "status": "queued",
                }
            ).execute()

    if update_cursor:
        db.table("ops_briefing_preferences").update(
            {"last_briefing_at": now.isoformat(), "updated_at": now.isoformat()}
        ).eq("owner_id", pref["owner_id"]).execute()

    return {
        "owner_id": pref["owner_id"],
        "briefing_id": briefing["id"],
        "decisions": len(decisions),
        "recipients": len(recipients),
        "queued_sms": queue_sms,
    }


def generate_due_briefings(force_owner_id: str | None = None) -> list[dict[str, Any]]:
    db = get_supabase_client()
    now = datetime.now(timezone.utc)
    query = db.table("ops_briefing_preferences").select("*").eq("enabled", True)
    if force_owner_id:
        query = query.eq("owner_id", force_owner_id)
    preferences = query.execute().data or []
    result = []

    for pref in preferences:
        if not force_owner_id and not due(pref, now):
            continue
        last = _parse_dt(pref.get("last_briefing_at")) or _first_period_start(pref, now)
        owner = (
            db.table("owners")
            .select("id,name,display_name")
            .eq("id", pref["owner_id"])
            .single()
            .execute()
            .data
        )
        result.append(
            _create_briefing(
                db,
                pref=pref,
                owner=owner,
                now=now,
                period_start=last,
                queue_sms=True,
                update_cursor=True,
                frequency=str(pref.get("frequency") or "daily"),
            )
        )
    return result


def process_preview_requests() -> list[dict[str, Any]]:
    """Generate owner-requested previews without sending SMS or advancing the cursor."""
    db = get_supabase_client()
    now = datetime.now(timezone.utc)
    requests = (
        db.table("ops_briefing_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(20)
        .execute()
        .data
        or []
    )
    result = []

    for request in requests:
        db.table("ops_briefing_requests").update(
            {"status": "processing", "started_at": now.isoformat()}
        ).eq("id", request["id"]).execute()
        try:
            pref = (
                db.table("ops_briefing_preferences")
                .select("*")
                .eq("owner_id", request["owner_id"])
                .maybe_single()
                .execute()
                .data
            )
            if not pref:
                raise RuntimeError("Briefing preferences are not configured.")
            owner = (
                db.table("owners")
                .select("id,name,display_name")
                .eq("id", request["owner_id"])
                .single()
                .execute()
                .data
            )
            period_start = now - timedelta(hours=int(request.get("lookback_hours") or 24))
            generated = _create_briefing(
                db,
                pref=pref,
                owner=owner,
                now=now,
                period_start=period_start,
                queue_sms=False,
                update_cursor=False,
                frequency="preview",
            )
            db.table("ops_briefing_requests").update(
                {
                    "status": "completed",
                    "briefing_id": generated["briefing_id"],
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error": None,
                }
            ).eq("id", request["id"]).execute()
            result.append({"request_id": request["id"], **generated})
        except Exception as exc:
            db.table("ops_briefing_requests").update(
                {
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error": str(exc),
                }
            ).eq("id", request["id"]).execute()
    return result
