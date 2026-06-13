from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

import pandas as pd
import streamlit as st

from rental_intel.cleaning.db import get_supabase_client


def _rows(result: Any) -> list[dict[str, Any]]:
    return result.data or []


def _ids(rows: list[dict[str, Any]], key: str) -> list[str]:
    return sorted({str(row[key]) for row in rows if row.get(key)})


def _by_id(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row["id"]): row for row in rows if row.get("id")}


def _by_key(rows: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    return {str(row[key]): row for row in rows if row.get(key)}


def _signed_photo_url(supabase: Any, bucket: str, path: str) -> str | None:
    try:
        result = supabase.storage.from_(bucket).create_signed_url(path, 3600)
    except Exception as exc:
        st.warning(f"Impossible de créer l'URL photo : {exc}")
        return None

    if isinstance(result, dict):
        return (
            result.get("signedURL")
            or result.get("signedUrl")
            or result.get("signed_url")
            or (result.get("data") or {}).get("signedUrl")
            or (result.get("data") or {}).get("signedURL")
        )

    return getattr(result, "signed_url", None)


def _fmt_dt(value: str | None) -> str:
    if not value:
        return "—"

    try:
        dt = pd.to_datetime(value)
        if pd.isna(dt):
            return "—"
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(value)

def _fmt_date(value: str | None) -> str:
    if not value:
        return "—"

    try:
        dt = pd.to_datetime(value)
        if pd.isna(dt):
            return "—"
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return str(value)
    
def _status_label(status: str | None) -> str:
    return {
        "sent": "Proposée",
        "accepted": "Acceptée",
        "in_progress": "En cours",
        "report_submitted": "Rapport reçu",
        "problem_reported": "Problème signalé",
        "completed": "Terminée",
        "refused": "Refusée",
        "cancelled": "Annulée",
    }.get(status or "", status or "—")


def render_cleaning_reports_page() -> None:
    st.title("🧹 Rapports de ménage")
    st.caption("Suivi des missions acceptées, rapports envoyés, problèmes et photos.")

    supabase = get_supabase_client()

    requests = _rows(
        supabase.table("cleaning_requests")
        .select(
            "id,property_id,reservation_id,cleaning_profile_id,assigned_cleaner_id,"
            "scheduled_start_at,scheduled_end_at,status,urgent,total_cost_eur,created_at"
        )
        .order("scheduled_start_at", desc=True)
        .limit(80)
        .execute()
    )

    if not requests:
        st.info("Aucune mission de ménage trouvée.")
        return

    request_ids = _ids(requests, "id")
    property_ids = _ids(requests, "property_id")
    cleaner_ids = _ids(requests, "assigned_cleaner_id")
    reservation_ids = _ids(requests, "reservation_id")

    properties = _by_id(
        _rows(
            supabase.table("properties")
            .select("id,name,address")
            .in_("id", property_ids)
            .execute()
        )
        if property_ids
        else []
    )

    cleaners = _by_id(
        _rows(
            supabase.table("cleaners")
            .select("id,first_name,last_name,phone")
            .in_("id", cleaner_ids)
            .execute()
        )
        if cleaner_ids
        else []
    )

    reservations = _by_id(
        _rows(
            supabase.table("reservations")
            .select(
                "id,source_system,source_booking_id,guest_name,"
                "checkin_at,checkout_at,next_checkin_at,number_of_guests,nights,status"
            )
            .in_("id", reservation_ids)
            .execute()
        )
        if reservation_ids
        else []
    )

    reports = _rows(
        supabase.table("cleaning_reports")
        .select(
            "id,cleaning_request_id,cleaner_id,status,submitted_at,ready_for_guests,"
            "damage_found,damage_notes,missing_items,missing_items_notes,"
            "guest_left_items,guest_left_items_notes,linen_problem,linen_notes,"
            "consumables_problem,consumables_notes,general_notes"
        )
        .in_("cleaning_request_id", request_ids)
        .execute()
    )

    reports_by_request = _by_key(reports, "cleaning_request_id")
    report_ids = _ids(reports, "id")

    section_checks = _rows(
        supabase.table("cleaning_report_section_checks")
        .select(
            "cleaning_report_id,section_key,title,high_level_check_label,"
            "checked,checked_at,details_viewed_at,notes"
        )
        .in_("cleaning_report_id", report_ids)
        .execute()
    ) if report_ids else []

    checks_by_report: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for check in section_checks:
        checks_by_report[str(check["cleaning_report_id"])].append(check)

    photos = _rows(
        supabase.table("cleaning_report_photos")
        .select(
            "id,cleaning_report_id,cleaning_request_id,section_key,photo_type,"
            "storage_bucket,storage_path,original_filename,size_bytes,uploaded_at"
        )
        .in_("cleaning_report_id", report_ids)
        .order("uploaded_at", desc=True)
        .execute()
    ) if report_ids else []

    photos_by_report: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for photo in photos:
        photos_by_report[str(photo["cleaning_report_id"])].append(photo)

    # Summary metrics
    submitted_count = sum(1 for row in requests if row.get("status") in ["report_submitted", "problem_reported"])
    problem_count = sum(1 for row in requests if row.get("status") == "problem_reported")
    accepted_count = sum(1 for row in requests if row.get("status") == "accepted")

    c1, c2, c3 = st.columns(3)
    c1.metric("Rapports reçus", submitted_count)
    c2.metric("Problèmes signalés", problem_count)
    c3.metric("Missions acceptées sans rapport", accepted_count)

    status_filter = st.multiselect(
        "Statut",
        options=[
            "accepted",
            "in_progress",
            "report_submitted",
            "problem_reported",
            "sent",
            "refused",
            "cancelled",
        ],
        default=["accepted", "in_progress", "report_submitted", "problem_reported"],
        format_func=_status_label,
    )

    filtered_requests = [
        row for row in requests if not status_filter or row.get("status") in status_filter
    ]

    for request in filtered_requests:
        request_id = str(request["id"])
        report = reports_by_request.get(request_id)

        property_ = properties.get(str(request.get("property_id")), {})
        cleaner = cleaners.get(str(request.get("assigned_cleaner_id")), {})
        reservation = reservations.get(str(request.get("reservation_id")), {})

        arrival = reservation.get("checkin_at")
        departure = reservation.get("checkout_at")
        guest_name = reservation.get("guest_name")

        departure_date = _fmt_date(departure or request.get("scheduled_start_at"))
        mission_date = _fmt_dt(request.get("scheduled_start_at"))
        property_name = property_.get("name", "Logement")

        status = request.get("status")
        
        report_status = report.get("status") if report else None
        if departure:
            title = f"{property_name} · Départ {departure_date} · {_status_label(status)}"
        else:
            title = f"{property_name} · Mission {mission_date} · {_status_label(status)}"

        if guest_name:
            title += f" · {guest_name}"


        cleaner_name = " ".join(
            part for part in [cleaner.get("first_name"), cleaner.get("last_name")] if part
        ) or "Intervenante non renseignée"



        departure_date = _fmt_date(reservation.get("departure"))
        guest_name = " ".join(
            part for part in [
                reservation.get("guest_first_name"),
                reservation.get("guest_last_name"),
            ]
            if part
        )

        with st.expander(title, expanded=status in ["problem_reported"]):
            left, right = st.columns([2, 1])

            with left:
                st.write(f"**Logement :** {property_name}")
                if property_.get("address"):
                    st.write(f"**Adresse :** {property_['address']}")
                st.write(f"**Intervenante :** {cleaner_name}")
                st.write(f"**Arrivée voyageur :** {_fmt_date(arrival)}")
                st.write(f"**Départ voyageur :** {_fmt_date(departure)}")

                if reservation.get("number_of_guests") is not None:
                    st.write(f"**Voyageurs :** {reservation['number_of_guests']}")

                if reservation.get("nights") is not None:
                    st.write(f"**Nuits :** {reservation['nights']}")

                if reservation.get("source_booking_id"):
                    st.write(f"**Réservation :** {reservation['source_booking_id']}")
                st.write(f"**Début prévu :** {_fmt_dt(request.get('scheduled_start_at'))}")
                st.write(f"**Statut mission :** {_status_label(status)}")

            with right:
                if request.get("urgent"):
                    st.warning("Urgent")
                if request.get("total_cost_eur") is not None:
                    st.metric("Montant prévu", f"{float(request['total_cost_eur']):.2f} €")

            if not report:
                st.info("Aucun rapport envoyé pour cette mission.")
                continue

            st.divider()

            st.subheader("Rapport")
            st.write(f"**Statut rapport :** {report_status or '—'}")
            st.write(f"**Envoyé le :** {_fmt_dt(report.get('submitted_at'))}")

            if report.get("ready_for_guests"):
                st.success("Logement déclaré prêt pour les voyageurs.")
            else:
                st.warning("Le rapport contient un problème ou n'indique pas que le logement est prêt.")

            problem_fields = [
                ("Dégât constaté", report.get("damage_found"), report.get("damage_notes")),
                ("Objet ou équipement manquant", report.get("missing_items"), report.get("missing_items_notes")),
                ("Objet oublié par un voyageur", report.get("guest_left_items"), report.get("guest_left_items_notes")),
                ("Problème de linge", report.get("linen_problem"), report.get("linen_notes")),
                ("Produits d’accueil manquants", report.get("consumables_problem"), report.get("consumables_notes")),
            ]

            active_problems = [
                (label, notes) for label, active, notes in problem_fields if active
            ]

            if active_problems:
                st.error("Problème signalé")
                for label, notes in active_problems:
                    st.write(f"**{label}**")
                    if notes:
                        st.write(notes)
            else:
                st.success("Aucun problème signalé.")

            if report.get("general_notes"):
                st.write("**Notes générales**")
                st.write(report["general_notes"])

            st.subheader("Checklist validée")
            checks = checks_by_report.get(str(report["id"]), [])

            if checks:
                checklist_df = pd.DataFrame(
                    [
                        {
                            "Rubrique": check.get("title"),
                            "Validée": "✅" if check.get("checked") else "❌",
                            "Détails vus": "✅" if check.get("details_viewed_at") else "❌",
                            "Note": check.get("notes") or "",
                        }
                        for check in checks
                    ]
                )
                st.dataframe(checklist_df, use_container_width=True, hide_index=True)
            else:
                st.info("Aucun détail de checklist enregistré.")

            st.subheader("Photos")
            report_photos = photos_by_report.get(str(report["id"]), [])

            if not report_photos:
                st.info("Aucune photo envoyée.")
            else:
                for photo in report_photos:
                    bucket = photo.get("storage_bucket")
                    path = photo.get("storage_path")

                    st.caption(
                        f"{photo.get('section_key') or 'section inconnue'} · "
                        f"{photo.get('original_filename') or ''} · "
                        f"{_fmt_dt(photo.get('uploaded_at'))}"
                    )

                    if bucket and path:
                        url = _signed_photo_url(supabase, bucket, path)
                        if url:
                            st.image(url, use_container_width=True)
                        else:
                            st.code(path)
                    else:
                        st.warning("Photo sans bucket/path.")