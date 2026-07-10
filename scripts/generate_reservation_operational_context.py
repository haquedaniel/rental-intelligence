from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def status_is_cancelled(row: dict[str, Any]) -> bool:
    return str(row.get("status") or "").lower() in {"cancelled", "canceled"}


def mission_is_active(row: dict[str, Any]) -> bool:
    return str(row.get("status") or "").lower() not in {"cancelled", "refused"}


def mission_done(row: dict[str, Any]) -> bool:
    return str(row.get("status") or "").lower() in {"completed", "report_submitted", "problem_reported"}


def mission_accepted(row: dict[str, Any]) -> bool:
    return str(row.get("status") or "").lower() in {"accepted", "completed", "report_submitted", "problem_reported"}


def lifecycle_state(reservation: dict[str, Any], now: datetime) -> str:
    if status_is_cancelled(reservation):
        return "cancelled"

    checkin = parse_dt(reservation.get("checkin_at"))
    checkout = parse_dt(reservation.get("checkout_at"))

    if not checkin or not checkout:
        return "unknown"

    if now < checkin:
        return "before_arrival"

    if checkin <= now < checkout:
        return "turnover_today" if now.date() == checkout.date() else "in_stay"

    return "after_checkout"


def title_for_context(
    state: str,
    preparation_mission: dict[str, Any] | None,
    checkout_mission: dict[str, Any] | None,
    latest_report: dict[str, Any] | None,
) -> tuple[str, str, str, str]:
    if state == "before_arrival":
        mission = preparation_mission
        if not mission:
            return (
                "Préparation à vérifier",
                "Aucune mission de préparation n’est liée à cette arrivée.",
                "Créer / vérifier",
                "",
            )
        if mission_done(mission):
            return ("Arrivée préparée", "La mission de préparation est terminée.", "Voir rapport", "")
        if mission_accepted(mission):
            return ("Préparation sous contrôle", "La mission de préparation est acceptée.", "Voir mission", "")
        return ("Préparation à confirmer", "La mission existe mais n’est pas encore acceptée.", "Voir mission", "")

    if state in {"in_stay", "turnover_today"}:
        mission = checkout_mission
        if not mission:
            return (
                "Départ à préparer",
                "Aucune mission n’est liée au départ de cette réservation.",
                "Créer / vérifier",
                "",
            )
        if mission_done(mission):
            return ("Rotation terminée", "La mission liée au départ est terminée.", "Voir rapport", "")
        if mission_accepted(mission):
            return ("Départ sous contrôle", "La mission liée au départ est acceptée.", "Voir mission", "")
        return ("Mission à confirmer", "La mission liée au départ existe mais n’est pas encore acceptée.", "Voir mission", "")

    if state == "after_checkout":
        if latest_report:
            return ("Rapport reçu", "Le rapport de ménage est disponible pour ce séjour.", "Voir rapport", "")
        mission = checkout_mission
        if mission and mission_done(mission):
            return ("Ménage terminé", "La mission est terminée, mais aucun rapport lié n’a été identifié.", "Voir mission", "")
        if mission:
            return ("Rapport attendu", "Le séjour est terminé et la mission n’a pas encore de rapport identifié.", "Voir mission", "")
        return ("Après-départ à vérifier", "Aucune mission ou rapport n’est lié au départ de cette réservation.", "Vérifier", "")

    if state == "cancelled":
        return ("Réservation annulée", "Cette réservation est annulée.", "", "")

    return ("Contexte incomplet", "Certaines données manquent pour qualifier cette réservation.", "", "")


def risk_for_context(
    state: str,
    preparation_mission: dict[str, Any] | None,
    checkout_mission: dict[str, Any] | None,
    latest_report: dict[str, Any] | None,
) -> str:
    if state == "before_arrival":
        if not preparation_mission:
            return "action"
        if mission_done(preparation_mission) or mission_accepted(preparation_mission):
            return "none"
        return "watch"

    if state in {"in_stay", "turnover_today"}:
        if not checkout_mission:
            return "action"
        if mission_done(checkout_mission) or mission_accepted(checkout_mission):
            return "none"
        return "watch"

    if state == "after_checkout":
        if latest_report:
            return "none"
        if checkout_mission:
            return "watch"
        return "action"

    return "none"


def index_by_property(reservations: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in reservations:
        if not row.get("property_id") or status_is_cancelled(row):
            continue
        grouped.setdefault(str(row["property_id"]), []).append(row)

    for rows in grouped.values():
        rows.sort(key=lambda item: item.get("checkin_at") or "")
    return grouped


def find_previous_next(
    reservation: dict[str, Any],
    reservations_by_property: dict[str, list[dict[str, Any]]],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    rows = reservations_by_property.get(str(reservation.get("property_id")), [])
    previous = None
    next_reservation = None

    checkin = reservation.get("checkin_at") or ""
    checkout = reservation.get("checkout_at") or ""

    for candidate in rows:
        if candidate.get("id") == reservation.get("id"):
            continue
        if (candidate.get("checkout_at") or "") <= checkin:
            previous = candidate
        elif (candidate.get("checkin_at") or "") >= checkout and next_reservation is None:
            next_reservation = candidate

    return previous, next_reservation


def load_all(supabase):
    reservations = supabase.table("reservations").select("*").order("checkin_at").execute().data or []
    requests = supabase.table("cleaning_requests").select("*").execute().data or []
    reports = supabase.table("cleaning_reports").select("*").order("created_at", desc=True).execute().data or []
    return reservations, requests, reports


def main() -> None:
    load_dotenv()
    supabase = get_supabase_client()

    reservations, requests, reports = load_all(supabase)
    reservations_by_property = index_by_property(reservations)

    requests_by_reservation: dict[str, list[dict[str, Any]]] = {}
    for request in requests:
        if not mission_is_active(request):
            continue
        rid = request.get("reservation_id")
        if rid:
            requests_by_reservation.setdefault(str(rid), []).append(request)

    reports_by_request: dict[str, list[dict[str, Any]]] = {}
    for report in reports:
        rid = report.get("cleaning_request_id")
        if rid:
            reports_by_request.setdefault(str(rid), []).append(report)

    now = datetime.now(timezone.utc)
    payloads: list[dict[str, Any]] = []

    for reservation in reservations:
        previous, next_reservation = find_previous_next(reservation, reservations_by_property)
        linked_requests = requests_by_reservation.get(str(reservation["id"]), [])

        # In current data model, a request linked to this reservation is usually
        # the checkout mission caused by this reservation's departure.
        checkout_mission = linked_requests[0] if linked_requests else None

        # Preparation mission is usually the previous reservation's checkout mission.
        preparation_mission = None
        if previous:
            previous_requests = requests_by_reservation.get(str(previous["id"]), [])
            preparation_mission = previous_requests[0] if previous_requests else None

        latest_report = None
        if checkout_mission:
            report_rows = reports_by_request.get(str(checkout_mission["id"]), [])
            latest_report = report_rows[0] if report_rows else None

        state = lifecycle_state(reservation, now)
        title, summary, action_label, action_href = title_for_context(
            state,
            preparation_mission,
            checkout_mission,
            latest_report,
        )
        risk = risk_for_context(state, preparation_mission, checkout_mission, latest_report)

        if action_label and checkout_mission:
            action_href = f"/owner/issues/request/{checkout_mission['id']}"
        elif action_label and preparation_mission:
            action_href = f"/owner/issues/request/{preparation_mission['id']}"

        payloads.append(
            {
                "reservation_id": reservation["id"],
                "lifecycle_state": state,
                "previous_reservation_id": previous.get("id") if previous else None,
                "next_reservation_id": next_reservation.get("id") if next_reservation else None,
                "preparation_mission_id": preparation_mission.get("id") if preparation_mission else None,
                "checkout_mission_id": checkout_mission.get("id") if checkout_mission else None,
                "latest_cleaning_report_id": latest_report.get("id") if latest_report else None,
                "risk_level": risk,
                "primary_title": title,
                "primary_summary": summary,
                "primary_action_label": action_label or None,
                "primary_action_href": action_href or None,
                "context_payload": {
                    "generated_from": "generate_reservation_operational_context.py",
                    "generated_at": now.isoformat(),
                },
                "generated_at": now.isoformat(),
            }
        )

    print(f"Operational contexts to upsert: {len(payloads)}")
    if payloads[:3]:
        import json
        print(json.dumps(payloads[:3], indent=2, ensure_ascii=False, default=str))

    if payloads:
        supabase.table("reservation_operational_context").upsert(
            payloads,
            on_conflict="reservation_id",
        ).execute()

    print("Done.")


if __name__ == "__main__":
    main()
