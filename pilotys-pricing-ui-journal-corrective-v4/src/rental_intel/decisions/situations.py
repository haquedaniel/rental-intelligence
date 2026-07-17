from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from rental_intel.cleaning.db import get_supabase_client


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _property_names(db: Any) -> dict[str, str]:
    rows = db.table("properties").select("id,name").execute().data or []
    return {str(row["id"]): str(row.get("name") or "Ce logement") for row in rows}


def _month_label(dates: list[str]) -> str | None:
    months = []
    for value in dates:
        try:
            date = datetime.fromisoformat(str(value)).date()
        except ValueError:
            continue
        months.append((date.year, date.month))
    if not months:
        return None

    counts: dict[tuple[int, int], int] = defaultdict(int)
    for month in months:
        counts[month] += 1
    year, month = max(counts, key=counts.get)
    labels = {
        1: "janvier",
        2: "février",
        3: "mars",
        4: "avril",
        5: "mai",
        6: "juin",
        7: "juillet",
        8: "août",
        9: "septembre",
        10: "octobre",
        11: "novembre",
        12: "décembre",
    }
    return f"{labels[month]} {year}"


def _upsert(db: Any, payload: dict[str, Any]) -> int:
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        db.table("ops_situations").upsert(
            payload,
            on_conflict="situation_key",
        ).execute()
        return 1
    except Exception as exc:
        print(f"WARN situation {payload.get('situation_key')}: {exc}")
        return 0



def _to_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except ValueError:
        return None


def _date_range_label(dates: list[str]) -> str | None:
    parsed = sorted(value for value in (_to_date(item) for item in dates) if value)
    if not parsed:
        return None
    months = {1: "janv.", 2: "févr.", 3: "mars", 4: "avr.", 5: "mai", 6: "juin", 7: "juil.", 8: "août", 9: "sept.", 10: "oct.", 11: "nov.", 12: "déc."}
    first, last = parsed[0], parsed[-1]
    if first == last:
        return f"{first.day} {months[first.month]} {first.year}"
    if first.year == last.year:
        return f"du {first.day} {months[first.month]} au {last.day} {months[last.month]} {last.year}"
    return f"du {first.day} {months[first.month]} {first.year} au {last.day} {months[last.month]} {last.year}"



def _pricing_trigger(db: Any, decision: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    metadata = decision.get("metadata") or {}
    explicit = str(metadata.get("trigger") or "")
    if explicit:
        return explicit, metadata
    calendar_version_id = decision.get("pricing_calendar_version_id")
    if not calendar_version_id:
        return "automatic_pricing", metadata
    try:
        calendar = (db.table("pricing_calendar_versions")
                    .select("configuration_version_id")
                    .eq("id", calendar_version_id)
                    .maybe_single().execute().data)
        configuration_id = calendar.get("configuration_version_id") if calendar else None
        if not configuration_id:
            return "automatic_pricing", metadata
        config = (db.table("pricing_configuration_versions")
                  .select("id,created_by,change_summary,rolled_back_from_version_id")
                  .eq("id", configuration_id)
                  .maybe_single().execute().data or {})
        created_by = str(config.get("created_by") or "")
        trigger = ("owner_configuration" if created_by.startswith("owner:")
                   else "admin_configuration" if created_by == "admin"
                   else "automatic_pricing")
        return trigger, {**metadata, "trigger": trigger, "created_by": created_by or None, "change_summary": config.get("change_summary"), "configuration_version_id": configuration_id, "rolled_back_from_version_id": config.get("rolled_back_from_version_id")}
    except Exception as exc:
        print(f"WARN pricing provenance {calendar_version_id}: {exc}")
        return "automatic_pricing", metadata

def _pricing_date_evidence(db: Any, *, calendar_version_id: str | None, dates: list[str]) -> list[dict[str, Any]]:
    if not calendar_version_id or not dates:
        return []
    try:
        rows = (db.table("pricing_daily_prices")
                .select("date,base_price,final_price,strategy_adjustment,source_season_id,market_signal_pct,time_discount_pct,calendar_version_id")
                .eq("calendar_version_id", calendar_version_id)
                .in_("date", dates)
                .order("date")
                .execute().data or [])
    except Exception as exc:
        print(f"WARN pricing evidence {calendar_version_id}: {exc}")
        return []
    return [{k: row.get(k) for k in ("date", "base_price", "final_price", "strategy_adjustment", "source_season_id", "market_signal_pct", "time_discount_pct")} for row in rows]

def _pricing_story(*, property_name: str, latest: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    metadata = latest.get("metadata") or {}
    count = int(metadata.get("changed_dates") or 0)
    avg_pct = float(metadata.get("average_change_pct") or 0)
    avg_eur = float(metadata.get("average_change_eur") or 0)
    temporal_count = int(metadata.get("temporal_change_count") or 0)
    dates = sorted({str(value) for value in metadata.get("dates") or []})
    period = _date_range_label(dates)
    market_count = sum(1 for row in evidence if abs(float(row.get("market_signal_pct") or 0)) >= 0.01)

    if avg_pct <= -0.5:
        situation_type = "pricing_more_competitive"
        headline = f"J’ai rendu certaines dates plus attractives pour {property_name}"
        action = f"J’ai réduit les prix concernés d’environ {abs(avg_pct):.1f}% en moyenne" + (f" ({abs(avg_eur):.0f} €)." if abs(avg_eur) >= 1 else ".")
        next_step = "Je continuerai de suivre les réservations avant toute nouvelle baisse."
    elif avg_pct >= 0.5:
        situation_type = "pricing_value_protected"
        headline = f"J’ai relevé certains prix pour {property_name}"
        action = f"J’ai augmenté les prix concernés d’environ {avg_pct:.1f}% en moyenne" + (f" ({avg_eur:.0f} €)." if abs(avg_eur) >= 1 else ".")
        next_step = "Je vérifierai si les réservations confirment ce niveau."
    else:
        situation_type = "pricing_fine_tuned"
        headline = f"J’ai affiné certains prix pour {property_name}"
        action = "Les variations restent faibles."
        next_step = "Je poursuivrai cette surveillance automatiquement."

    situation = f"{count} date(s)" + (f" {period}" if period else "") + " ont été ajustées automatiquement."
    reasons = []
    if temporal_count:
        reasons.append(f"{temporal_count} date(s) ont évolué avec l’approche de leur arrivée")
    if market_count:
        reasons.append(f"le signal de marché a influencé {market_count} date(s)")
    if not reasons:
        reasons.append("le calcul automatique a réévalué les prix à partir des paramètres en vigueur")
    explanation = "; ".join(reasons)
    explanation = explanation[0].upper() + explanation[1:] + "."

    return {
        "situation_type": situation_type,
        "headline": headline,
        "situation_text": situation,
        "explanation_text": explanation,
        "action_text": action,
        "next_step_text": next_step,
        "status": "active",
        "priority": "info",
        "requires_owner_action": False,
        "metadata": {
            **metadata,
            "latest_decision_id": latest["id"],
            "pricing_calendar_version_id": latest.get("pricing_calendar_version_id"),
            "market_change_count": market_count,
            "date_range": period,
            "dates": dates,
            "date_details": evidence,
            "trigger": "automatic_pricing",
        },
    }

def _reservation_story(decision: dict[str, Any], property_name: str) -> dict[str, Any]:
    decision_type = str(decision.get("decision_type") or "")
    metadata = decision.get("metadata") or {}
    guest = str(metadata.get("guest_name") or "Un voyageur")
    checkin = metadata.get("checkin_at")
    checkout = metadata.get("checkout_at")
    stay = ""
    if checkin and checkout:
        stay = f" du {str(checkin)[:10]} au {str(checkout)[:10]}"

    if decision_type == "reservation_created":
        return {
            "situation_type": "reservation_received",
            "headline": f"Une nouvelle réservation est arrivée pour {property_name}",
            "situation_text": f"{guest} a réservé{stay}.",
            "explanation_text": "Le calendrier du logement est désormais occupé sur ces dates.",
            "action_text": "Pilotys a intégré le séjour et met à jour les opérations associées.",
            "next_step_text": "Aucune action n’est requise, sauf indication contraire dans Pilotys.",
            "status": "resolved",
            "priority": "important",
            "requires_owner_action": False,
            "metadata": metadata,
        }
    if decision_type == "reservation_cancelled":
        return {
            "situation_type": "reservation_cancelled",
            "headline": f"Une réservation a été annulée pour {property_name}",
            "situation_text": f"Le séjour de {guest}{stay} n’aura finalement pas lieu.",
            "explanation_text": "Ces dates redeviennent disponibles et doivent être reproposées.",
            "action_text": "Pilotys a remis le calendrier à jour et recalculera les prix et les missions.",
            "next_step_text": "Pilotys surveillera la remise en vente de ces dates.",
            "status": "active",
            "priority": "attention",
            "requires_owner_action": bool(decision.get("requires_owner_action")),
            "metadata": metadata,
        }
    return {
        "situation_type": "reservation_changed",
        "headline": f"Une réservation a changé pour {property_name}",
        "situation_text": f"Le séjour de {guest} a été modifié.",
        "explanation_text": "Les dates ou les informations transmises par la plateforme ont évolué.",
        "action_text": "Pilotys a resynchronisé le calendrier et les opérations liées.",
        "next_step_text": "Aucune action n’est requise, sauf si Pilotys signale un conflit.",
        "status": "resolved",
        "priority": "attention",
        "requires_owner_action": bool(decision.get("requires_owner_action")),
        "metadata": metadata,
    }


def _cleaning_story(decision: dict[str, Any], property_name: str) -> dict[str, Any]:
    decision_type = str(decision.get("decision_type") or "")
    metadata = decision.get("metadata") or {}

    if decision_type == "cleaner_accepted":
        return {
            "situation_type": "cleaning_confirmed",
            "headline": f"Le prochain ménage est confirmé pour {property_name}",
            "situation_text": "La personne chargée de la mission a accepté.",
            "explanation_text": "La mission dispose désormais d’une personne confirmée.",
            "action_text": "Pilotys a confirmé la mission dans le planning.",
            "next_step_text": "Aucune action n’est requise.",
            "status": "resolved",
            "priority": "info",
            "requires_owner_action": False,
            "metadata": metadata,
        }
    if decision_type == "cleaner_refused":
        return {
            "situation_type": "cleaning_needs_reassignment",
            "headline": f"Le ménage de {property_name} doit être réattribué",
            "situation_text": "La personne sollicitée a refusé la mission.",
            "explanation_text": str(metadata.get("refusal_reason") or "Aucun motif détaillé n’a été fourni."),
            "action_text": "Pilotys a signalé que la mission n’est plus couverte.",
            "next_step_text": "Une nouvelle affectation est nécessaire.",
            "status": "active",
            "priority": "important",
            "requires_owner_action": True,
            "metadata": metadata,
        }
    if decision_type == "cleaning_rescheduled":
        return {
            "situation_type": "cleaning_rescheduled",
            "headline": f"Le ménage de {property_name} a été replanifié",
            "situation_text": "La fenêtre de la mission a changé.",
            "explanation_text": "Le planning a évolué, notamment à la suite d’un changement de réservation.",
            "action_text": "Pilotys a mis à jour la mission et sa nouvelle échéance.",
            "next_step_text": "Aucune action n’est requise si la nouvelle mission est acceptée.",
            "status": "resolved",
            "priority": "info",
            "requires_owner_action": False,
            "metadata": metadata,
        }

    photo_count = int(metadata.get("photo_count") or 0)
    problem = bool(decision.get("requires_owner_action"))
    return {
        "situation_type": "cleaning_completed_with_issue" if problem else "cleaning_completed",
        "headline": (
            f"Le ménage est terminé, mais un point doit être vérifié à {property_name}"
            if problem
            else f"{property_name} est prêt pour les prochains voyageurs"
        ),
        "situation_text": "Le compte rendu de ménage a été transmis.",
        "explanation_text": (
            "Un problème ou un élément manquant a été signalé."
            if problem
            else "La mission a été réalisée sans problème nécessitant votre attention."
        ),
        "action_text": (
            f"Pilotys a conservé {photo_count} photo(s) et les remarques de la mission."
        ),
        "next_step_text": (
            "Consultez le compte rendu dans Pilotys."
            if problem
            else "Aucune action n’est requise."
        ),
        "status": "active" if problem else "resolved",
        "priority": "attention" if problem else "info",
        "requires_owner_action": problem,
        "metadata": metadata,
    }


def build_situations(lookback_days: int = 7, owner_id: str | None = None) -> dict[str, int]:
    db = get_supabase_client()
    since = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    legacy = (db.table("ops_situations")
              .update({"status": "dismissed", "resolved_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()})
              .like("situation_key", "pricing:%:latest"))
    if owner_id:
        legacy = legacy.eq("owner_id", owner_id)
    try:
        legacy.execute()
    except Exception as exc:
        print(f"WARN archive legacy pricing situations: {exc}")

    query = db.table("ops_decisions").select("*").gte("occurred_at", since.isoformat()).order("occurred_at")
    if owner_id:
        query = query.eq("owner_id", owner_id)
    decisions = query.execute().data or []
    names = _property_names(db)
    counts = {"pricing": 0, "pricing_suppressed_configuration": 0, "reservation": 0, "cleaning": 0, "total": 0}

    for decision in decisions:
        property_id = str(decision.get("property_id") or "")
        property_name = names.get(property_id, "ce logement")
        decision_type = str(decision.get("decision_type") or "")
        category = str(decision.get("category") or "")

        if decision_type == "pricing_session":
            trigger, metadata = _pricing_trigger(db, decision)
            if trigger in {"owner_configuration", "admin_configuration"}:
                counts["pricing_suppressed_configuration"] += 1
                continue
            decision = {**decision, "metadata": metadata}
            dates = sorted({str(value) for value in metadata.get("dates") or []})
            evidence = _pricing_date_evidence(db, calendar_version_id=decision.get("pricing_calendar_version_id"), dates=dates)
            story = _pricing_story(property_name=property_name, latest=decision, evidence=evidence)
            payload = {
                "owner_id": decision["owner_id"],
                "property_id": decision.get("property_id"),
                "situation_key": f"pricing:{decision.get('pricing_calendar_version_id') or decision['id']}",
                "first_observed_at": decision["occurred_at"],
                "last_observed_at": decision["occurred_at"],
                "source_decision_ids": [decision["id"]],
                **story,
            }
            counts["pricing"] += _upsert(db, payload)
            continue

        if decision_type == "minimum_stay_session":
            continue
        if category == "reservation":
            story = _reservation_story(decision, property_name)
            counts["reservation"] += 1
        elif category == "cleaning":
            story = _cleaning_story(decision, property_name)
            counts["cleaning"] += 1
        else:
            continue

        payload = {
            "owner_id": decision["owner_id"],
            "property_id": decision.get("property_id"),
            "situation_key": f"{story['situation_type']}:{decision['id']}",
            "first_observed_at": decision["occurred_at"],
            "last_observed_at": decision["occurred_at"],
            "source_decision_ids": [decision["id"]],
            **story,
        }
        _upsert(db, payload)

    counts["total"] = counts["pricing"] + counts["reservation"] + counts["cleaning"]
    return counts

