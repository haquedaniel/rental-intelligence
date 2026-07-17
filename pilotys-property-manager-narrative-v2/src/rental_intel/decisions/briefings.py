from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from rental_intel.cleaning.db import get_supabase_client
from rental_intel.decisions.situations import build_situations


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


def _owner_label(owner: dict[str, Any]) -> str:
    return owner.get("display_name") or owner.get("name") or "vous"


def _opening(pref: dict[str, Any], now: datetime) -> str:
    tz = ZoneInfo(pref.get("timezone") or "Europe/Paris")
    hour = now.astimezone(tz).hour
    if hour < 12:
        return "Bonjour"
    if hour < 18:
        return "Bonjour"
    return "Bonsoir"


def _plain_story(situation: dict[str, Any]) -> str:
    """Turn one structured situation into natural property-manager prose."""
    headline = str(situation.get("headline") or "").strip()
    situation_text = str(situation.get("situation_text") or "").strip()
    action = str(situation.get("action_text") or "").strip()
    next_step = str(situation.get("next_step_text") or "").strip()

    parts = []
    if headline:
        parts.append(headline.rstrip(".") + ".")
    if situation_text and situation_text.lower() not in headline.lower():
        parts.append(situation_text)
    if action:
        # First-person voice is intentional: the owner experiences Pilotys as
        # the manager keeping them informed, not as a reporting database.
        action = action.replace("Pilotys a ", "J’ai ").replace("Pilotys continuera", "Je continuerai")
        action = action.replace("Pilotys vérifiera", "Je vérifierai").replace(
            "Pilotys poursuivra", "Je poursuivrai"
        )
        parts.append(action)
    if next_step:
        next_step = next_step.replace("Pilotys continuera", "Je continuerai")
        next_step = next_step.replace("Pilotys surveillera", "Je surveillerai")
        next_step = next_step.replace("Pilotys vérifiera", "Je vérifierai")
        if next_step not in parts:
            parts.append(next_step)
    return " ".join(part.strip() for part in parts if part.strip())


def render(owner: dict[str, Any], pref: dict[str, Any], situations: list[dict[str, Any]], now: datetime) -> str:
    name = _owner_label(owner)
    lines = [f"{_opening(pref, now)} {name},", ""]

    if not situations:
        lines.extend(
            [
                "Rien de notable ne nécessite votre attention depuis mon dernier point.",
                "",
                "Je continue de surveiller les réservations, les prix et les opérations.",
                "",
                "— Pilotys",
            ]
        )
        return "\n".join(lines)

    attention = [s for s in situations if s.get("requires_owner_action")]
    ordinary = [s for s in situations if not s.get("requires_owner_action")]

    selected = attention[:2] + ordinary[:3]
    for index, situation in enumerate(selected):
        if index:
            lines.append("")
        lines.append(_plain_story(situation))

    remaining = len(situations) - len(selected)
    if remaining > 0:
        lines.extend(
            [
                "",
                f"J’ai regroupé {remaining} autre(s) évolution(s) moins importante(s) dans le journal Pilotys.",
            ]
        )

    lines.append("")
    lines.append(
        "Une action est nécessaire : consultez Pilotys."
        if attention
        else "Rien ne nécessite votre intervention pour le moment."
    )
    lines.extend(["", "— Pilotys"])
    return "\n".join(lines)


def _first_period_start(pref: dict[str, Any], now: datetime) -> datetime:
    updated = _parse_dt(pref.get("updated_at"))
    recent_floor = now - timedelta(hours=6)
    if updated and updated > recent_floor:
        return updated
    return recent_floor


def _allowed_situation(situation: dict[str, Any], pref: dict[str, Any]) -> bool:
    included = pref.get("included_property_ids") or []
    if included and situation.get("property_id") not in included:
        return False

    situation_type = str(situation.get("situation_type") or "")
    if situation_type.startswith("pricing_") and not pref.get("include_pricing", True):
        return False
    if situation_type.startswith("reservation_") and not pref.get("include_reservations", True):
        return False
    if situation_type.startswith("cleaning_"):
        if situation_type == "cleaning_completed" and not pref.get("include_cleaning_completed", True):
            return False
        if situation_type == "cleaning_confirmed" and not pref.get("include_cleaner_accepted", True):
            return False
        if situation_type == "cleaning_needs_reassignment" and not pref.get("include_cleaner_refused", True):
            return False
        if situation_type == "cleaning_rescheduled" and not pref.get("include_cleaning_rescheduled", True):
            return False
    return True


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
    rows = (
        db.table("ops_situations")
        .select("*")
        .eq("owner_id", pref["owner_id"])
        .gt("last_observed_at", period_start.isoformat())
        .lte("last_observed_at", now.isoformat())
        .order("requires_owner_action", desc=True)
        .order("last_observed_at", desc=True)
        .execute()
        .data
        or []
    )
    situations = [row for row in rows if _allowed_situation(row, pref)]
    body = render(owner, pref, situations, now)
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
                "decision_ids": [],
                "situation_ids": [row["id"] for row in situations],
                "decision_count": len(situations),
                "requires_owner_action": any(
                    row.get("requires_owner_action") for row in situations
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
        "situations": len(situations),
        "recipients": len(recipients),
        "queued_sms": queue_sms,
    }


def generate_due_briefings(force_owner_id: str | None = None) -> list[dict[str, Any]]:
    db = get_supabase_client()
    now = datetime.now(timezone.utc)

    # Refresh the communication layer before every briefing. The pricing,
    # reservation and cleaning engines remain unchanged.
    build_situations(lookback_days=7, owner_id=force_owner_id)

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
            build_situations(lookback_days=7, owner_id=request["owner_id"])
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
            generated = _create_briefing(
                db,
                pref=pref,
                owner=owner,
                now=now,
                period_start=now - timedelta(hours=int(request.get("lookback_hours") or 24)),
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
