from __future__ import annotations

from datetime import date, timedelta

import pandas as pd


DEFAULT_CLEANING_COST_BY_LISTING = {
    "apt2": 55.0,
    "apt4": 55.0,
    "apt5": 45.0,
    "peskerezh_house": 85.0,
}

DEFAULT_CLEANING_COST = 55.0


def _to_date(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce").dt.date


def _safe_int(value: object) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(float(value))
    except Exception:
        return 0


def _safe_money(value: object) -> float:
    try:
        if pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def _estimated_cleaning_cost_for_listing(listing_id: object) -> float:
    key = str(listing_id).strip()
    return DEFAULT_CLEANING_COST_BY_LISTING.get(key, DEFAULT_CLEANING_COST)


def _client_name(row: pd.Series) -> str:
    """
    Best-effort guest/client name from the reservation file.
    Handles several likely column names so the UI does not depend on one exact export format.
    """
    candidate_cols = [
        "guest_name",
        "client_name",
        "customer_name",
        "name",
        "guest_full_name",
        "full_name",
        "guest",
    ]

    for col in candidate_cols:
        if col in row.index:
            value = row.get(col)
            if pd.notna(value) and str(value).strip():
                return str(value).strip()

    first = ""
    last = ""

    for col in ["first_name", "firstname", "guest_first_name"]:
        if col in row.index and pd.notna(row.get(col)) and str(row.get(col)).strip():
            first = str(row.get(col)).strip()
            break

    for col in ["last_name", "lastname", "guest_last_name", "surname"]:
        if col in row.index and pd.notna(row.get(col)) and str(row.get(col)).strip():
            last = str(row.get(col)).strip()
            break

    full = f"{first} {last}".strip()
    return full if full else "Client non renseigné"


def _normalise_reservations(reservations: pd.DataFrame) -> pd.DataFrame:
    if reservations.empty:
        return reservations

    df = reservations.copy()

    for col in ["arrival", "departure"]:
        if col in df.columns:
            df[col] = _to_date(df[col])

    if "status" not in df.columns:
        df["status"] = ""

    if "listing_id" not in df.columns:
        df["listing_id"] = ""

    if "channel" not in df.columns:
        df["channel"] = ""

    if "num_adult" not in df.columns:
        df["num_adult"] = 0

    if "num_child" not in df.columns:
        df["num_child"] = 0

    if "nights" not in df.columns:
        df["nights"] = 0

    if "source_booking_id" not in df.columns:
        if "booking_id" in df.columns:
            df["source_booking_id"] = df["booking_id"]
        else:
            df["source_booking_id"] = ""

    df["is_cancelled"] = df["status"].astype(str).str.lower().str.contains(
        "cancel", na=False
    )

    return df[~df["is_cancelled"]].copy()


def _normalise_cleaner_due(cleaner_due: pd.DataFrame) -> pd.DataFrame:
    if cleaner_due.empty:
        return cleaner_due

    df = cleaner_due.copy()

    for col in ["arrival", "departure", "date"]:
        if col in df.columns:
            df[col] = _to_date(df[col])

    if "departure" not in df.columns and "date" in df.columns:
        df["departure"] = df["date"]

    if "listing_id" not in df.columns:
        df["listing_id"] = ""

    if "expense_amount" not in df.columns:
        df["expense_amount"] = 0.0

    if "cleaner_name" not in df.columns:
        df["cleaner_name"] = ""

    if "status" not in df.columns:
        df["status"] = "À confirmer"

    if "source_booking_id" not in df.columns:
        df["source_booking_id"] = ""

    df["expense_amount"] = pd.to_numeric(df["expense_amount"], errors="coerce").fillna(
        0.0
    )

    return df.copy()


def _build_expected_cleanings(departures: pd.DataFrame) -> pd.DataFrame:
    """
    Operational assumption:
    every departure creates a cleaning task unless explicitly excluded later.

    cleaner_payment_due.csv / cleaner_due rows enrich this expected task list;
    they do not define the whole cleaning universe.
    """
    if departures.empty:
        return pd.DataFrame()

    expected = departures.copy()
    expected["cleaning_date"] = expected["departure"]
    expected["cleaning_status"] = "À assigner"
    expected["cleaner_name"] = ""
    expected["expense_amount"] = expected["listing_id"].apply(
        _estimated_cleaning_cost_for_listing
    )
    expected["expense_amount_is_estimate"] = True

    return expected


def _merge_cleaner_info(
    expected_cleanings: pd.DataFrame,
    cleaner_due: pd.DataFrame,
    period_start: date,
    period_end: date,
) -> pd.DataFrame:
    """
    Merge known cleaner/payment rows onto the expected cleaning tasks.

    Match currently uses listing_id + departure date.
    Later this should use a durable booking/task ID once the cleaner app exists.
    """
    if expected_cleanings.empty:
        return pd.DataFrame()

    if cleaner_due.empty or "departure" not in cleaner_due.columns:
        cleanings = expected_cleanings.copy()
    else:
        clean_period = cleaner_due[
            (cleaner_due["departure"] >= period_start)
            & (cleaner_due["departure"] < period_end)
        ].copy()

        if clean_period.empty:
            cleanings = expected_cleanings.copy()
        else:
            merge_keys = ["listing_id", "departure"]

            cleanings = expected_cleanings.merge(
                clean_period,
                on=merge_keys,
                how="left",
                suffixes=("", "_cleaner"),
            )

            if "cleaner_name_cleaner" in cleanings.columns:
                cleanings["cleaner_name"] = cleanings[
                    "cleaner_name_cleaner"
                ].fillna(cleanings["cleaner_name"])

            if "expense_amount_cleaner" in cleanings.columns:
                cleaner_amount = pd.to_numeric(
                    cleanings["expense_amount_cleaner"],
                    errors="coerce",
                )

                has_real_amount = cleaner_amount.notna() & (cleaner_amount > 0)

                cleanings.loc[has_real_amount, "expense_amount"] = cleaner_amount.loc[
                    has_real_amount
                ]
                cleanings.loc[has_real_amount, "expense_amount_is_estimate"] = False

            if "status_cleaner" in cleanings.columns:
                cleanings["cleaning_status"] = cleanings["status_cleaner"].fillna(
                    cleanings["cleaning_status"]
                )

            if "source_booking_id_cleaner" in cleanings.columns:
                cleanings["source_booking_id"] = cleanings[
                    "source_booking_id_cleaner"
                ].fillna(cleanings["source_booking_id"])

    cleanings["cleaner_name"] = cleanings["cleaner_name"].fillna("").astype(str)
    cleanings["cleaning_status"] = cleanings["cleaning_status"].fillna("À assigner")

    cleanings["expense_amount"] = pd.to_numeric(
        cleanings["expense_amount"], errors="coerce"
    )

    missing_amount = cleanings["expense_amount"].isna() | (
        cleanings["expense_amount"] <= 0
    )

    if missing_amount.any():
        estimated_amounts = (
            cleanings.loc[missing_amount, "listing_id"]
            .apply(_estimated_cleaning_cost_for_listing)
            .astype(float)
        )

        cleanings.loc[missing_amount, "expense_amount"] = estimated_amounts

    if "expense_amount_is_estimate" not in cleanings.columns:
        cleanings["expense_amount_is_estimate"] = True

    cleanings["expense_amount_is_estimate"] = cleanings[
        "expense_amount_is_estimate"
    ].fillna(True).astype(bool)

    return cleanings.copy()

def _build_timeline(
    arrivals: pd.DataFrame,
    departures: pd.DataFrame,
    cleanings: pd.DataFrame,
) -> pd.DataFrame:
    timeline_rows: list[dict] = []

    for _, row in arrivals.iterrows():
        client = _client_name(row)

        timeline_rows.append(
            {
                "date": row["arrival"],
                "type": "arrival",
                "listing_id": row.get("listing_id", ""),
                "title": f"Arrivée · {row.get('listing_id', '')}",
                "detail": (
                    f"{client} · "
                    f"{_safe_int(row.get('num_adult'))} adultes · "
                    f"{_safe_int(row.get('num_child'))} enfants · "
                    f"{row.get('channel', '')}"
                ),
                "badge": "Arrivée",
                "kind": "green",
                "source_booking_id": row.get("source_booking_id", ""),
            }
        )

    for _, row in departures.iterrows():
        client = _client_name(row)

        timeline_rows.append(
            {
                "date": row["departure"],
                "type": "departure",
                "listing_id": row.get("listing_id", ""),
                "title": f"Départ · {row.get('listing_id', '')}",
                "detail": (
                    f"{client} · "
                    f"{_safe_int(row.get('nights'))} nuits · "
                    f"{row.get('channel', '')}"
                ),
                "badge": "Départ",
                "kind": "amber",
                "source_booking_id": row.get("source_booking_id", ""),
            }
        )

    for _, row in cleanings.iterrows():
        amount = _safe_money(row.get("expense_amount"))
        cleaner = str(row.get("cleaner_name", "") or "").strip()
        cleaner_text = cleaner if cleaner else "cleaner à assigner"
        status = str(row.get("cleaning_status", "À assigner"))

        is_estimate = bool(row.get("expense_amount_is_estimate", True))
        amount_label = f"{amount:.0f} € estimés" if is_estimate else f"{amount:.0f} €"

        kind = "green" if cleaner else "amber"

        timeline_rows.append(
            {
                "date": row.get("cleaning_date", row.get("departure")),
                "type": "cleaning",
                "listing_id": row.get("listing_id", ""),
                "title": f"Ménage · {row.get('listing_id', '')}",
                "detail": f"{cleaner_text} · {amount_label}",
                "badge": status,
                "kind": kind,
                "source_booking_id": row.get("source_booking_id", ""),
            }
        )

    timeline = pd.DataFrame(timeline_rows)

    if timeline.empty:
        return timeline

    type_order = {
        "departure": 1,
        "cleaning": 2,
        "arrival": 3,
    }

    timeline["type_order"] = timeline["type"].map(type_order).fillna(9)

    return (
        timeline.sort_values(["date", "listing_id", "type_order"])
        .drop(columns=["type_order"])
        .reset_index(drop=True)
    )


def _build_alerts(cleanings: pd.DataFrame) -> list[dict]:
    alerts: list[dict] = []

    if cleanings.empty:
        return alerts

    if "cleaner_name" not in cleanings.columns:
        return alerts

    unassigned = cleanings[
        cleanings["cleaner_name"].astype(str).str.strip().eq("")
    ].copy()

    for _, row in unassigned.head(10).iterrows():
        alerts.append(
            {
                "level": "warning",
                "title": f"Ménage à assigner · {row.get('listing_id', '')}",
                "detail": f"Départ le {row.get('departure')}, aucun cleaner confirmé.",
            }
        )

    return alerts


def _build_same_day_turnovers(
    arrivals: pd.DataFrame,
    departures: pd.DataFrame,
) -> pd.DataFrame:
    same_day_rows: list[dict] = []

    if departures.empty or arrivals.empty:
        return pd.DataFrame()

    for _, dep in departures.iterrows():
        listing_id = str(dep.get("listing_id", ""))
        dep_date = dep.get("departure")

        same_day_arrivals = arrivals[
            (arrivals["listing_id"].astype(str) == listing_id)
            & (arrivals["arrival"] == dep_date)
        ]

        for _, _arr in same_day_arrivals.iterrows():
            same_day_rows.append(
                {
                    "date": dep_date,
                    "listing_id": listing_id,
                    "title": f"Turnover même jour · {listing_id}",
                    "detail": "Départ et arrivée le même jour : ménage prioritaire.",
                }
            )

    return pd.DataFrame(same_day_rows)


def build_operations_view(
    reservations: pd.DataFrame,
    cleaner_due: pd.DataFrame,
    period_start: date,
    period_end: date,
) -> dict:
    res = _normalise_reservations(reservations)
    clean = _normalise_cleaner_due(cleaner_due)

    if res.empty:
        arrivals = pd.DataFrame()
        departures = pd.DataFrame()
    else:
        arrivals = res[
            (res["arrival"] >= period_start)
            & (res["arrival"] < period_end)
        ].copy()

        departures = res[
            (res["departure"] >= period_start)
            & (res["departure"] < period_end)
        ].copy()

    expected_cleanings = _build_expected_cleanings(departures)

    cleanings = _merge_cleaner_info(
        expected_cleanings=expected_cleanings,
        cleaner_due=clean,
        period_start=period_start,
        period_end=period_end,
    )

    timeline = _build_timeline(
        arrivals=arrivals,
        departures=departures,
        cleanings=cleanings,
    )

    alerts = _build_alerts(cleanings)

    same_day = _build_same_day_turnovers(
        arrivals=arrivals,
        departures=departures,
    )

    assigned_cleanings = 0
    unassigned_cleanings = 0

    if not cleanings.empty and "cleaner_name" in cleanings.columns:
        cleaner_names = cleanings["cleaner_name"].astype(str).str.strip()
        assigned_cleanings = int(cleaner_names.ne("").sum())
        unassigned_cleanings = int(cleaner_names.eq("").sum())

    cleaning_cost_estimate = 0.0
    cleaning_cost_confirmed = 0.0
    cleaning_cost_estimated_only = 0.0

    if not cleanings.empty and "expense_amount" in cleanings.columns:
        amounts = pd.to_numeric(cleanings["expense_amount"], errors="coerce").fillna(0.0)
        cleaning_cost_estimate = _safe_money(amounts.sum())

        if "expense_amount_is_estimate" in cleanings.columns:
            is_estimate = cleanings["expense_amount_is_estimate"].fillna(True).astype(bool)
            cleaning_cost_confirmed = _safe_money(amounts[~is_estimate].sum())
            cleaning_cost_estimated_only = _safe_money(amounts[is_estimate].sum())
        else:
            cleaning_cost_estimated_only = cleaning_cost_estimate

    summary = {
        "arrivals": len(arrivals),
        "departures": len(departures),
        "cleanings": len(cleanings),
        "cleanings_assigned": assigned_cleanings,
        "cleanings_unassigned": unassigned_cleanings,
        "alerts": len(alerts),
        "same_day_turnovers": len(same_day),
        "cleaning_cost_estimate": cleaning_cost_estimate,
        "cleaning_cost_confirmed": cleaning_cost_confirmed,
        "cleaning_cost_estimated_only": cleaning_cost_estimated_only,
    }

    return {
        "summary": summary,
        "timeline": timeline,
        "arrivals": arrivals,
        "departures": departures,
        "cleanings": cleanings,
        "alerts": alerts,
        "same_day": same_day,
    }


def default_operations_range() -> tuple[date, date]:
    today = date.today()
    return today, today + timedelta(days=14)


def operations_bounds(reservations: pd.DataFrame) -> tuple[date, date]:
    today = date.today()

    if reservations.empty or "arrival" not in reservations.columns:
        return today - timedelta(days=30), today + timedelta(days=365)

    df = reservations.copy()

    dates = []

    if "arrival" in df.columns:
        df["arrival"] = pd.to_datetime(df["arrival"], errors="coerce").dt.date
        dates.extend(df["arrival"].dropna().tolist())

    if "departure" in df.columns:
        df["departure"] = pd.to_datetime(df["departure"], errors="coerce").dt.date
        dates.extend(df["departure"].dropna().tolist())

    if not dates:
        return today - timedelta(days=30), today + timedelta(days=365)

    return min(dates), max(dates) + timedelta(days=1)