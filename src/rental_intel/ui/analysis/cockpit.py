from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

DEFAULT_CLEANING_COST_BY_LISTING = {
    "apt2": 105.0,
    "apt4": 105.0,
    "apt5": 85.0,
    "peskerezh_house": 120.0,
}

DEFAULT_CLEANING_COST = 105.0


def _estimated_cleaning_cost_for_listing(listing_id: object) -> float:
    key = str(listing_id).strip()
    return DEFAULT_CLEANING_COST_BY_LISTING.get(key, DEFAULT_CLEANING_COST)


def _cleaning_estimate(row: pd.Series) -> float:
    """
    Operational cleaning estimate.

    Important: cleaning_fee is what the guest was charged.
    It can be 0 on tactical/direct bookings, but the operational cleaning still exists.
    """
    for col in [
        "actual_cleaning_cost",
        "cleaning_actual_cost",
        "expense_amount",
    ]:
        if col in row.index:
            value = pd.to_numeric(row.get(col), errors="coerce")
            if pd.notna(value) and float(value) > 0:
                return float(value)

    if "cleaning_fee" in row.index:
        value = pd.to_numeric(row.get("cleaning_fee"), errors="coerce")
        if pd.notna(value) and float(value) > 0:
            return float(value)

    return _estimated_cleaning_cost_for_listing(row.get("listing_id", ""))


def _safe_int(value: object) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(float(value))
    except Exception:
        return 0


def _read_year_month(value: object) -> str:
    text = str(value)
    if len(text) >= 7:
        return text[:7]
    return ""

def _client_name(row: pd.Series) -> str:
    first = ""
    last = ""

    if "guest_first_name" in row.index:
        value = row.get("guest_first_name")
        if pd.notna(value) and str(value).strip():
            first = str(value).strip()

    if "guest_last_name" in row.index:
        value = row.get("guest_last_name")
        if pd.notna(value) and str(value).strip():
            last = str(value).strip()

    full = f"{first} {last}".strip()

    if full:
        return full

    fallback_cols = [
        "guest_name",
        "client_name",
        "customer_name",
        "guest_full_name",
        "full_name",
        "name",
    ]

    for col in fallback_cols:
        if col in row.index:
            value = row.get(col)
            if pd.notna(value) and str(value).strip():
                return str(value).strip()

    return "Client non renseigné"


def _safe_sum(df: pd.DataFrame, col: str) -> float:
    if df.empty or col not in df.columns:
        return 0.0
    return float(pd.to_numeric(df[col], errors="coerce").fillna(0).sum())


def _safe_pct(value: float, target: float) -> float | None:
    if not target:
        return None
    return value / target * 100


def _current_month_from_files(
    dashboard: pd.DataFrame,
    listing_financials: pd.DataFrame,
) -> str:
    if not dashboard.empty and "current_month" in dashboard.columns:
        months = dashboard["current_month"].dropna().astype(str).tolist()
        if months:
            return months[0][:7]

    if not listing_financials.empty and "year_month" in listing_financials.columns:
        months = sorted(listing_financials["year_month"].dropna().astype(str).unique())
        if months:
            return months[-1][:7]

    return date.today().strftime("%Y-%m")

def build_cockpit_summary(
    dashboard: pd.DataFrame,
    listing_financials: pd.DataFrame,
    variable_costs: pd.DataFrame,
    reservations: pd.DataFrame,
    cleaner_due: pd.DataFrame,
    market_benchmark: pd.DataFrame,
    period_start: date,
    period_end: date,
) -> dict:
    year = period_start.year

    period_start_month = period_start.strftime("%Y-%m")
    period_end_inclusive = period_end - timedelta(days=1)
    period_end_month = period_end_inclusive.strftime("%Y-%m")

    period_label = (
        period_start_month
        if period_start_month == period_end_month
        else f"{period_start_month} → {period_end_month}"
    )

    d = dashboard.copy()
    lf = listing_financials.copy()
    vc = variable_costs.copy()
    res = reservations.copy()
    cd = cleaner_due.copy()
    mb = market_benchmark.copy()

    if not lf.empty and "year_month" in lf.columns:
        lf["year_month_norm"] = lf["year_month"].astype(str).str[:7]

        month_fin = lf[
            (lf["year_month_norm"] >= period_start_month)
            & (lf["year_month_norm"] <= period_end_month)
        ].copy()

        if "year" in lf.columns:
            year_fin = lf[pd.to_numeric(lf["year"], errors="coerce") == year].copy()
            ytd_fin = lf[
                (pd.to_numeric(lf["year"], errors="coerce") == year)
                & (lf["year_month_norm"] <= date.today().strftime("%Y-%m"))
            ].copy()
        else:
            year_fin = lf[lf["year_month_norm"].str[:4] == str(year)].copy()
            ytd_fin = lf[
                (lf["year_month_norm"].str[:4] == str(year))
                & (lf["year_month_norm"] <= date.today().strftime("%Y-%m"))
            ].copy()
    else:
        month_fin = pd.DataFrame()
        year_fin = pd.DataFrame()
        ytd_fin = pd.DataFrame()

    # Annual / YTD KPIs stay stable.
    annual_on_books = _safe_sum(year_fin, "host_payout")
    annual_target = _safe_sum(d, "target_host_payout")

    actual_to_date = _safe_sum(ytd_fin, "host_payout")

    today = date.today()
    elapsed_months = max(1, min(today.month, 12)) if year == today.year else 12
    target_to_date = annual_target * elapsed_months / 12 if annual_target else 0.0

    # Period KPIs follow the slider.
    period_ca = _safe_sum(month_fin, "host_payout")
    period_after_variables = _safe_sum(month_fin, "rental_contribution")

    # Period target: pragmatic monthly target allocation for now.
    if not d.empty and "current_month_target_host_payout" in d.columns:
        monthly_target = _safe_sum(d, "current_month_target_host_payout")
    elif annual_target:
        monthly_target = annual_target / 12
    else:
        monthly_target = 0.0

    months_in_period = max(
        1,
        len(
            pd.period_range(
                start=period_start_month,
                end=period_end_month,
                freq="M",
            )
        ),
    )

    period_target = monthly_target * months_in_period

    top_kpis = {
        "annual_on_books": {
            "label": "Sur les livres · année",
            "value": annual_on_books,
            "target": annual_target,
            "pct": _safe_pct(annual_on_books, annual_target),
            "kind": "green",
        },
        "actual_to_date": {
            "label": "Réalisé à date",
            "value": actual_to_date,
            "target": target_to_date,
            "pct": _safe_pct(actual_to_date, target_to_date),
            "kind": "blue",
        },
        "month_ca": {
            "label": "CA période",
            "value": period_ca,
            "target": period_target,
            "pct": _safe_pct(period_ca, period_target),
            "kind": "amber",
        },
        "month_after_variables": {
            "label": "Période · après variables",
            "value": period_after_variables,
            "target": period_target,
            "pct": _safe_pct(period_after_variables, period_target),
            "kind": "green",
        },
    }

    # Costs for selected period.
    costs = {
        "Conciergerie": _safe_sum(month_fin, "concierge_fee")
        or _safe_sum(month_fin, "concierge"),
        "Ménage": _safe_sum(month_fin, "actual_cleaning_cost")
        or _safe_sum(month_fin, "cleaning_actual_cost"),
        "Énergie": 0.0,
        "Eau": 0.0,
        "Autres variables": 0.0,
    }

    if not vc.empty and "year_month" in vc.columns:
        vc["year_month_norm"] = vc["year_month"].astype(str).str[:7]
        vc_month = vc[
            (vc["year_month_norm"] >= period_start_month)
            & (vc["year_month_norm"] <= period_end_month)
        ].copy()

        amount_col = "expense_amount" if "expense_amount" in vc_month.columns else None

        if amount_col and "category" in vc_month.columns:
            costs["Énergie"] = _safe_sum(
                vc_month[
                    vc_month["category"]
                    .astype(str)
                    .str.contains("energy|énergie|electric|élec", case=False, na=False)
                ],
                amount_col,
            )
            costs["Eau"] = _safe_sum(
                vc_month[
                    vc_month["category"]
                    .astype(str)
                    .str.contains("water|eau", case=False, na=False)
                ],
                amount_col,
            )
            known_var = costs["Énergie"] + costs["Eau"]
            total_var = _safe_sum(vc_month, amount_col)
            costs["Autres variables"] = max(total_var - known_var, 0.0)

    # Listing contribution cards.
    listing_rows = []

    if not month_fin.empty:
        group_cols = ["listing_id"]

        if "listing_name" in month_fin.columns:
            group_cols.append("listing_name")

        agg_spec = {
            "gross": ("host_payout", "sum"),
            "after_variables": ("rental_contribution", "sum"),
            "after_fixed": ("attributed_profit", "sum"),
        }

        if "booked_nights" in month_fin.columns:
            agg_spec["booked_nights"] = ("booked_nights", "sum")

        if "available_nights" in month_fin.columns:
            agg_spec["available_nights"] = ("available_nights", "sum")

        if "occupancy_pct" in month_fin.columns:
            agg_spec["occupancy_pct"] = ("occupancy_pct", "mean")
            
        for col in ["attributed_profit", "rental_contribution"]:
            if col not in month_fin.columns:
                month_fin[col] = 0.0

        month_fin["attributed_profit"] = pd.to_numeric(
            month_fin["attributed_profit"],
            errors="coerce",
        ).fillna(0.0)

        month_fin["rental_contribution"] = pd.to_numeric(
            month_fin["rental_contribution"],
            errors="coerce",
        ).fillna(0.0)


        listing_summary = (
            month_fin.groupby(group_cols, dropna=False)
            .agg(**agg_spec)
            .reset_index()
            .sort_values("gross", ascending=False)
        )

        listing_rows = listing_summary.to_dict("records")

    # Attention list from market benchmark.
    attention = []

    if not mb.empty and "price_position" in mb.columns:
        b = mb.copy()

        priority = {
            "well_below_market": 1,
            "below_market": 2,
            "no_comparison": 3,
            "well_above_market": 4,
            "above_market": 5,
            "near_market": 9,
        }

        b["priority"] = b["price_position"].map(priority).fillna(8)

        if "check_in" in b.columns:
            b = b.sort_values(["priority", "check_in"]).head(3)
        else:
            b = b.sort_values(["priority"]).head(3)

        for _, row in b.iterrows():
            attention.append(
                {
                    "title": f"{row.get('listing_id', '')} · {row.get('check_in', '')} → {row.get('check_out', '')}",
                    "detail": str(row.get("pricing_guidance", "")),
                    "badge": str(row.get("price_position", "signal")),
                    "kind": "red"
                    if str(row.get("price_position", "")).endswith("below_market")
                    else "amber",
                }
            )

    operations = build_operations_preview(
        reservations=res,
        cleaner_due=cd,
        today=today,
        days_ahead=14,
    )

    trajectory = "Sur la bonne trajectoire"
    annual_pct = top_kpis["annual_on_books"]["pct"]

    if annual_pct is not None and annual_pct < 70:
        trajectory = "À surveiller"

    if annual_pct is not None and annual_pct >= 95:
        trajectory = "Très bonne trajectoire"

    return {
        "period_start": period_start,
        "period_end": period_end,
        "period_label": period_label,
        "top_kpis": top_kpis,
        "costs": costs,
        "listing_rows": listing_rows,
        "attention": attention,
        "operations": operations,
        "trajectory": trajectory,
    }

def build_operations_preview(
    reservations: pd.DataFrame,
    cleaner_due: pd.DataFrame,
    today: date,
    days_ahead: int = 14,
) -> list[dict]:
    if reservations.empty:
        return []

    res = reservations.copy()

    for col in ["arrival", "departure"]:
        if col in res.columns:
            res[col] = pd.to_datetime(res[col], errors="coerce").dt.date

    window_end = today + timedelta(days=days_ahead)
    rows: list[dict] = []

    arrivals = res[
        (res["arrival"] >= today)
        & (res["arrival"] <= window_end)
        & ~res["status"].astype(str).str.lower().str.contains("cancel", na=False)
    ].copy()

    departures = res[
        (res["departure"] >= today)
        & (res["departure"] <= window_end)
        & ~res["status"].astype(str).str.lower().str.contains("cancel", na=False)
    ].copy()

    for _, row in arrivals.sort_values("arrival").head(6).iterrows():
        rows.append(
            {
                "date": row["arrival"],
                "type": "arrival",
                "title": f"Arrivée · {row.get('listing_id', '')}",
                "detail": (
                    f"{_client_name(row)} · "
                    f"{_safe_int(row.get('num_adult'))} adultes · "
                    f"{_safe_int(row.get('num_child'))} enfants · "
                    f"{row.get('channel', '')}"
                ),                
                "badge": "Arrivée",
                "kind": "green",
            }
        )

    for _, row in departures.sort_values("departure").head(6).iterrows():
        rows.append(
            {
                "date": row["departure"],
                "type": "departure",
                "title": f"Départ · {row.get('listing_id', '')}",
                "detail": (
                    f"{_client_name(row)} · "
                    f"{_safe_int(row.get('nights'))} nuits · "
                    "ménage à prévoir"
                ),                
                "badge": "Ménage",
                "kind": "amber",
            }
        )

    if not cleaner_due.empty:
        cd = cleaner_due.copy()

        if "departure" in cd.columns:
            cd["departure"] = pd.to_datetime(cd["departure"], errors="coerce").dt.date
            cd = cd[(cd["departure"] >= today) & (cd["departure"] <= window_end)].copy()

            for _, row in cd.sort_values("departure").head(4).iterrows():
                #amount = pd.to_numeric(pd.Series([row.get("expense_amount")]), errors="coerce").fillna(0).iloc[0]
                amount = _cleaning_estimate(row)
                rows.append(
                    {
                        "date": row["departure"],
                        "type": "cleaning",
                        "title": f"Ménage · {row.get('listing_id', '')}",
                        "detail": f"Montant estimé {amount:.0f} € · réservation {row.get('source_booking_id', '')}",
                        "badge": "À confirmer",
                        "kind": "blue",
                    }
                )

    rows = sorted(rows, key=lambda x: (x["date"], x["type"]))

    return rows[:10]