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


def _pricing_story(
    *,
    property_name: str,
    latest: dict[str, Any],
    sessions: list[dict[str, Any]],
) -> dict[str, Any]:
    metadata = latest.get("metadata") or {}
    count = int(metadata.get("changed_dates") or 0)
    avg_pct = float(metadata.get("average_change_pct") or 0)
    avg_eur = float(metadata.get("average_change_eur") or 0)
    temporal_count = int(metadata.get("temporal_change_count") or 0)
    dates = [str(value) for value in metadata.get("dates") or []]
    month = _month_label(dates)
    period = f" pour {month}" if month else ""

    if avg_pct <= -0.5:
        situation_type = "pricing_more_competitive"
        headline = f"Pilotys rend certaines dates{period} plus attractives"
        situation = (
            f"Les derniers calculs indiquent qu’un prix un peu plus compétitif "
            f"est préférable sur {count} nuit(s) encore disponibles."
        )
        action = (
            f"Pilotys a réduit ces prix d’environ {abs(avg_pct):.1f}% en moyenne"
            f"{f' ({abs(avg_eur):.0f} €)' if abs(avg_eur) >= 1 else ''}."
        )
        next_step = (
            "Pilotys continuera de surveiller les réservations et les signaux du marché. "
            "Les prix ne baisseront de nouveau que si le prochain calcul le justifie."
        )
    elif avg_pct >= 0.5:
        situation_type = "pricing_value_protected"
        headline = f"Pilotys protège la valeur de certaines dates{period}"
        situation = (
            f"Les derniers signaux permettent de demander un peu plus sur "
            f"{count} nuit(s) encore disponibles."
        )
        action = (
            f"Pilotys a augmenté ces prix d’environ {avg_pct:.1f}% en moyenne"
            f"{f' ({avg_eur:.0f} €)' if abs(avg_eur) >= 1 else ''}."
        )
        next_step = (
            "Pilotys vérifiera si la demande confirme ce niveau avant toute nouvelle hausse."
        )
    else:
        situation_type = "pricing_fine_tuned"
        headline = f"Pilotys affine les prix{period}"
        situation = (
            f"Les prix de {count} nuit(s) ont été légèrement ajustés pour rester cohérents "
            "avec la saison, le marché et l’approche des séjours."
        )
        action = "Les variations restent faibles et aucun changement important n’a été nécessaire."
        next_step = "Pilotys poursuivra cette surveillance automatiquement."

    reasons = []
    if temporal_count:
        reasons.append(
            f"{temporal_count} nuit(s) se rapprochent de leur date d’arrivée"
        )
    reason_codes = {
        code
        for session in sessions
        for code in ((session.get("metadata") or {}).get("reason_codes") or [])
    }
    # Current pricing decisions do not always copy reason_codes into metadata.
    # The conservative fallback is deliberately generic and truthful.
    if not reasons:
        reasons.append("la saison, les prix du marché et le calendrier ont été réévalués")

    explanation = (
        reasons[0][0].upper() + reasons[0][1:] + "."
        if len(reasons) == 1
        else "; ".join(reasons) + "."
    )

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
            "latest_decision_id": latest["id"],
            "grouped_session_count": len(sessions),
            "changed_dates": count,
            "average_change_pct": round(avg_pct, 2),
            "average_change_eur": round(avg_eur, 2),
            "temporal_change_count": temporal_count,
            "dominant_month": month,
            "dates": dates,
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

    query = (
        db.table("ops_decisions")
        .select("*")
        .gte("occurred_at", since.isoformat())
        .order("occurred_at")
    )
    if owner_id:
        query = query.eq("owner_id", owner_id)
    decisions = query.execute().data or []
    names = _property_names(db)

    pricing_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    other: list[dict[str, Any]] = []

    for decision in decisions:
        property_id = str(decision.get("property_id") or "")
        if decision.get("decision_type") == "pricing_session":
            pricing_groups[(str(decision["owner_id"]), property_id)].append(decision)
        elif decision.get("decision_type") != "minimum_stay_session":
            other.append(decision)

    counts = {"pricing": 0, "reservation": 0, "cleaning": 0, "total": 0}

    for (current_owner_id, property_id), sessions in pricing_groups.items():
        sessions.sort(key=lambda row: str(row.get("occurred_at") or ""))
        latest = sessions[-1]
        story = _pricing_story(
            property_name=names.get(property_id, "ce logement"),
            latest=latest,
            sessions=sessions,
        )
        payload = {
            "owner_id": current_owner_id,
            "property_id": property_id or None,
            "situation_key": f"pricing:{property_id}:latest",
            "first_observed_at": sessions[0]["occurred_at"],
            "last_observed_at": latest["occurred_at"],
            "source_decision_ids": [row["id"] for row in sessions],
            **story,
        }
        counts["pricing"] += _upsert(db, payload)

    for decision in other:
        property_id = str(decision.get("property_id") or "")
        property_name = names.get(property_id, "ce logement")
        category = str(decision.get("category") or "")
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
