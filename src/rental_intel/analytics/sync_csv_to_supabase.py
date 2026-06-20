from __future__ import annotations

import argparse
import calendar
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pandas as pd
from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PROCESSED = ROOT / "outputs" / "processed"

CSV_SPECS = {
    "daily": {
        "path": "daily_calendar.csv",
        "table": "analytics_daily_calendar",
    },
    "monthly": {
        "path": "listing_month_financials.csv",
        "table": "analytics_listing_month_financials",
    },
    "kpis": {
        "path": "dashboard_kpis.csv",
        "table": "analytics_dashboard_kpis",
    },
    "market": {
        "path": "market_benchmark_latest.csv",
        "table": "analytics_market_benchmark_windows",
    },
    "quality": {
        "path": "data_quality_issues.csv",
        "table": "analytics_data_quality_issues",
    },
    "booking_expenses": {
        "path": "booking_expenses.csv",
        "table": "analytics_expense_lines",
    },
    "variable_period_costs": {
        "path": "variable_period_costs.csv",
        "table": "analytics_expense_lines",
    },
}

LISTING_ALIASES = {
    # Current bridge row uses "peskerezh"; analytics CSVs use "peskerezh_house".
    "peskerezh_house": ["peskerezh", "peskerezh_house"],
    "peskerezh": ["peskerezh_house", "peskerezh"],
}


def clean_value(value: Any) -> Any:
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, pd.Timestamp):
        if value.tzinfo is None:
            return value.isoformat()
        return value.to_pydatetime().isoformat()

    if hasattr(value, "item"):
        try:
            value = value.item()
        except Exception:
            pass

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    return value


def id_text(value: Any) -> str:
    value = clean_value(value)
    if value is None:
        return ""

    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]

    if text.lower() in {"nan", "none", "null"}:
        return ""

    return text


def text_value(row: pd.Series, column: str, default: str = "") -> str:
    text = id_text(row.get(column))
    return text if text else default


def nullable_text(row: pd.Series, column: str) -> str | None:
    text = id_text(row.get(column))
    return text or None


def numeric_value(row: pd.Series, column: str) -> float | None:
    value = clean_value(row.get(column))
    if value is None:
        return None

    try:
        number = float(value)
    except Exception:
        return None

    if math.isnan(number) or math.isinf(number):
        return None

    return number


def int_value(row: pd.Series, column: str) -> int | None:
    value = numeric_value(row, column)
    if value is None:
        return None
    return int(value)


def bool_value(row: pd.Series, column: str) -> bool | None:
    value = clean_value(row.get(column))
    if value is None:
        return None

    if isinstance(value, bool):
        return value

    text = str(value).strip().lower()
    if text in {"true", "1", "yes", "y"}:
        return True
    if text in {"false", "0", "no", "n"}:
        return False

    return None


def date_value(row: pd.Series, column: str) -> str | None:
    value = clean_value(row.get(column))
    if value is None:
        return None

    try:
        parsed = pd.to_datetime(value)
    except Exception:
        return None

    if pd.isna(parsed):
        return None

    return parsed.date().isoformat()


def month_start(year_month: str) -> str | None:
    if not year_month or len(year_month) < 7:
        return None
    return f"{year_month[:7]}-01"


def month_end(year_month: str) -> str | None:
    if not year_month or len(year_month) < 7:
        return None
    year = int(year_month[:4])
    month = int(year_month[5:7])
    return f"{year_month[:7]}-{calendar.monthrange(year, month)[1]:02d}"


def datetime_value(row: pd.Series, column: str) -> str | None:
    value = clean_value(row.get(column))
    if value is None:
        return None

    try:
        parsed = pd.to_datetime(value, utc=True)
    except Exception:
        return None

    if pd.isna(parsed):
        return None

    return parsed.to_pydatetime().isoformat()


def payload_from_row(row: pd.Series) -> dict[str, Any]:
    return {str(key): clean_value(value) for key, value in row.to_dict().items()}


def listing_candidates(listing_id: str) -> list[str]:
    listing_id = id_text(listing_id)
    if not listing_id:
        return []

    candidates = [listing_id]
    candidates.extend(LISTING_ALIASES.get(listing_id, []))

    seen = set()
    out: list[str] = []
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            out.append(candidate)

    return out


class PropertyMapper:
    def __init__(self, links: list[dict[str, Any]]) -> None:
        self.by_source: dict[tuple[str, str, str], str] = {}
        self.by_listing: dict[str, str] = {}

        for link in links:
            if not link.get("active", True):
                continue

            property_id = str(link["property_id"])
            source_system = id_text(link.get("source_system"))
            source_property_id = id_text(link.get("source_property_id"))
            source_room_id = id_text(link.get("source_room_id"))
            source_listing_id = id_text(link.get("source_listing_id"))

            if source_system and source_property_id:
                self.by_source[(source_system, source_property_id, source_room_id)] = property_id

            if source_listing_id:
                self.by_listing[source_listing_id] = property_id

    def resolve(self, row: pd.Series) -> str | None:
        source_property_id = id_text(row.get("source_property_id"))
        source_room_id = id_text(row.get("source_room_id"))
        source_system = id_text(row.get("source_system"))

        if source_property_id:
            if not source_system:
                source_system = "beds24"

            key = (source_system, source_property_id, source_room_id)
            if key in self.by_source:
                return self.by_source[key]

            # Some source rows may omit room id.
            fallback = (source_system, source_property_id, "")
            if fallback in self.by_source:
                return self.by_source[fallback]

        listing_id = id_text(row.get("listing_id"))
        for candidate in listing_candidates(listing_id):
            if candidate in self.by_listing:
                return self.by_listing[candidate]

        return None


def load_property_mapper(supabase) -> PropertyMapper:
    result = (
        supabase.table("property_source_links")
        .select("*")
        .eq("active", True)
        .execute()
    )
    links = result.data or []
    print(f"Loaded {len(links)} active property_source_links.")
    return PropertyMapper(links)


def row_key(*parts: Any) -> str:
    return ":".join(id_text(part) for part in parts)


def daily_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        date = date_value(row, "date")
        if not date:
            continue

        client_id = text_value(row, "client_id")
        portfolio_id = text_value(row, "portfolio_id")
        listing_id = text_value(row, "listing_id")
        source_booking_id = text_value(row, "source_booking_id")

        rows.append({
            "row_key": row_key("daily", client_id, portfolio_id, listing_id, date, source_booking_id),
            "client_id": client_id,
            "portfolio_id": portfolio_id,
            "portfolio_name": nullable_text(row, "portfolio_name"),
            "listing_id": listing_id,
            "listing_name": nullable_text(row, "listing_name"),
            "property_id": mapper.resolve(row),
            "source_system": nullable_text(row, "source_system"),
            "source_property_id": nullable_text(row, "source_property_id"),
            "source_room_id": nullable_text(row, "source_room_id"),
            "source_booking_id": source_booking_id or None,
            "date": date,
            "year_month": text_value(row, "year_month", date[:7]),
            "status": nullable_text(row, "status"),
            "channel": nullable_text(row, "channel"),
            "is_booked": bool_value(row, "is_booked"),
            "num_adult": numeric_value(row, "num_adult"),
            "num_child": numeric_value(row, "num_child"),
            "gross_booking_value_allocated": numeric_value(row, "gross_booking_value_allocated"),
            "accommodation_revenue_allocated": numeric_value(row, "accommodation_revenue_allocated"),
            "cleaning_fee_allocated": numeric_value(row, "cleaning_fee_allocated"),
            "tourist_tax_allocated": numeric_value(row, "tourist_tax_allocated"),
            "channel_commission_allocated": numeric_value(row, "channel_commission_allocated"),
            "host_payout_allocated": numeric_value(row, "host_payout_allocated"),
            "host_payout_minus_cleaning_allocated": numeric_value(row, "host_payout_minus_cleaning_allocated"),
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        })

    return rows


MONTHLY_NUMERIC_COLUMNS = [
    "booked_nights",
    "available_nights",
    "occupancy_pct",
    "adr_accommodation",
    "gross_booking_value",
    "accommodation_revenue",
    "cleaning_fee_charged",
    "tourist_tax",
    "channel_commission",
    "host_payout",
    "host_payout_minus_cleaning",
    "actual_cleaning_cost",
    "cleaning_margin",
    "concierge_fee",
    "other_booking_costs",
    "booking_associated_costs_total",
    "booking_contribution",
    "energy_usage_cost",
    "water_usage_cost",
    "variable_period_costs_total",
    "rental_contribution",
    "attributable_fixed_costs_total",
    "attributed_profit",
]


def monthly_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        client_id = text_value(row, "client_id")
        portfolio_id = text_value(row, "portfolio_id")
        listing_id = text_value(row, "listing_id")
        year_month = text_value(row, "year_month")

        if not year_month:
            continue

        out = {
            "row_key": row_key("monthly", client_id, portfolio_id, listing_id, year_month),
            "client_id": client_id,
            "portfolio_id": portfolio_id,
            "portfolio_name": nullable_text(row, "portfolio_name"),
            "listing_id": listing_id,
            "listing_name": nullable_text(row, "listing_name"),
            "property_id": mapper.resolve(row),
            "year": int_value(row, "year") or int(year_month[:4]),
            "month": int_value(row, "month") or int(year_month[5:7]),
            "year_month": year_month,
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        }

        for column in MONTHLY_NUMERIC_COLUMNS:
            out[column] = numeric_value(row, column)

        rows.append(out)

    return rows


KPI_NUMERIC_COLUMNS = [
    "current_month_host_payout",
    "current_month_target_host_payout",
    "current_month_vs_target",
    "current_month_target_pct",
    "current_month_operating_profit",
    "current_month_portfolio_cash_result",
    "ytd_host_payout",
    "target_host_payout",
    "host_payout_target_pct",
    "host_payout_remaining_to_target",
    "host_payout_required_per_remaining_month",
    "ytd_operating_profit",
    "ytd_portfolio_cash_result",
]


def kpi_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        client_id = text_value(row, "client_id")
        portfolio_id = text_value(row, "portfolio_id")
        year = int_value(row, "year")

        if not year:
            continue

        out = {
            "row_key": row_key("kpis", client_id, portfolio_id, year),
            "client_id": client_id,
            "portfolio_id": portfolio_id,
            "year": year,
            "current_month": nullable_text(row, "current_month"),
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        }

        for column in KPI_NUMERIC_COLUMNS:
            out[column] = numeric_value(row, column)

        rows.append(out)

    return rows


def market_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        check_in = date_value(row, "check_in")
        check_out = date_value(row, "check_out")
        listing_id = text_value(row, "listing_id")

        if not check_in or not check_out or not listing_id:
            continue

        run_id = text_value(row, "run_id")
        portfolio_id = text_value(row, "portfolio_id")
        market_set_id = text_value(row, "market_set_id")
        scenario_id = text_value(row, "scenario_id")

        rows.append({
            "row_key": row_key("market", run_id, portfolio_id, listing_id, market_set_id, scenario_id, check_in, check_out),
            "run_id": run_id or None,
            "retrieved_at": datetime_value(row, "retrieved_at"),
            "portfolio_id": portfolio_id or None,
            "market_set_id": market_set_id or None,
            "listing_id": listing_id,
            "property_id": mapper.resolve(row),
            "scenario_id": scenario_id or None,
            "check_in": check_in,
            "check_out": check_out,
            "nights": int_value(row, "nights"),
            "adults": int_value(row, "adults"),
            "children": int_value(row, "children"),
            "status": nullable_text(row, "status"),
            "bookable": bool_value(row, "bookable"),
            "own_total_amount": numeric_value(row, "own_total_amount"),
            "own_nightly_amount": numeric_value(row, "own_nightly_amount"),
            "competitors_checked": int_value(row, "competitors_checked"),
            "competitors_available": int_value(row, "competitors_available"),
            "competitors_unavailable": int_value(row, "competitors_unavailable"),
            "competitors_failed": int_value(row, "competitors_failed"),
            "competitors_usable": int_value(row, "competitors_usable"),
            "market_availability_rate": numeric_value(row, "market_availability_rate"),
            "market_unavailable_rate": numeric_value(row, "market_unavailable_rate"),
            "market_tension": nullable_text(row, "market_tension"),
            "competitor_adjusted_median_nightly": numeric_value(row, "competitor_adjusted_median_nightly"),
            "competitor_adjusted_p25_nightly": numeric_value(row, "competitor_adjusted_p25_nightly"),
            "competitor_adjusted_p75_nightly": numeric_value(row, "competitor_adjusted_p75_nightly"),
            "own_vs_adjusted_market_pct": numeric_value(row, "own_vs_adjusted_market_pct"),
            "price_position": nullable_text(row, "price_position"),
            "pricing_guidance": nullable_text(row, "pricing_guidance"),
            "warning": nullable_text(row, "warning"),
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        })

    return rows


def quality_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for idx, row in df.iterrows():
        severity = text_value(row, "severity")
        category = text_value(row, "category")
        issue = text_value(row, "issue")

        rows.append({
            "row_key": row_key("quality", severity, category, issue, idx),
            "severity": severity or None,
            "category": category or None,
            "issue": issue or None,
            "details": nullable_text(row, "details"),
            "affected_count": int_value(row, "affected_count"),
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        })

    return rows


def booking_expense_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for idx, row in df.iterrows():
        client_id = text_value(row, "client_id")
        portfolio_id = text_value(row, "portfolio_id")
        listing_id = text_value(row, "listing_id")
        source_booking_id = text_value(row, "source_booking_id")
        arrival = date_value(row, "arrival")
        departure = date_value(row, "departure")
        year_month = text_value(row, "year_month") or (departure or arrival or "")[:7]
        rule_id = text_value(row, "rule_id")
        category = text_value(row, "category")
        amount = numeric_value(row, "expense_amount")

        if not portfolio_id or not listing_id or not year_month:
            continue

        rows.append({
            "row_key": row_key(
                "expense",
                "booking",
                client_id,
                portfolio_id,
                listing_id,
                source_booking_id,
                year_month,
                rule_id,
                category,
                idx,
            ),
            "client_id": client_id or None,
            "portfolio_id": portfolio_id,
            "portfolio_name": nullable_text(row, "portfolio_name"),
            "listing_id": listing_id,
            "listing_name": nullable_text(row, "listing_name"),
            "property_id": mapper.resolve(row),
            "source_booking_id": source_booking_id or None,
            "expense_source": "booking_expenses",
            # For cleaning/payment purposes, booking-linked costs are recognised at departure.
            "expense_date": departure or arrival,
            "period_start": arrival,
            "period_end": departure,
            "year_month": year_month,
            "rule_id": rule_id or None,
            "category": category or None,
            "cost_family": nullable_text(row, "cost_family"),
            "calculation_type": nullable_text(row, "calculation_type"),
            "occupied_days": numeric_value(row, "nights"),
            "amount_per_day": None,
            "expense_amount": amount,
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        })

    return rows


def variable_period_cost_rows(df: pd.DataFrame, mapper: PropertyMapper, source_file: str, generated_at: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for idx, row in df.iterrows():
        client_id = text_value(row, "client_id")
        portfolio_id = text_value(row, "portfolio_id")
        listing_id = text_value(row, "listing_id")
        year_month = text_value(row, "year_month")
        rule_id = text_value(row, "rule_id")
        category = text_value(row, "category")

        if not portfolio_id or not listing_id or not year_month:
            continue

        rows.append({
            "row_key": row_key(
                "expense",
                "variable",
                client_id,
                portfolio_id,
                listing_id,
                year_month,
                rule_id,
                category,
                idx,
            ),
            "client_id": client_id or None,
            "portfolio_id": portfolio_id,
            "portfolio_name": nullable_text(row, "portfolio_name"),
            "listing_id": listing_id,
            "listing_name": nullable_text(row, "listing_name"),
            "property_id": mapper.resolve(row),
            "source_booking_id": None,
            "expense_source": "variable_period_costs",
            "expense_date": None,
            "period_start": month_start(year_month),
            "period_end": month_end(year_month),
            "year_month": year_month,
            "rule_id": rule_id or None,
            "category": category or None,
            "cost_family": nullable_text(row, "cost_family"),
            "calculation_type": nullable_text(row, "calculation_type"),
            "occupied_days": numeric_value(row, "occupied_days"),
            "amount_per_day": numeric_value(row, "amount_per_day"),
            "expense_amount": numeric_value(row, "expense_amount"),
            "payload": payload_from_row(row),
            "source_file": source_file,
            "generated_at": generated_at,
            "synced_at": generated_at,
        })

    return rows


BUILDERS: dict[str, Callable[[pd.DataFrame, PropertyMapper, str, str], list[dict[str, Any]]]] = {
    "daily": daily_rows,
    "monthly": monthly_rows,
    "kpis": kpi_rows,
    "market": market_rows,
    "quality": quality_rows,
    "booking_expenses": booking_expense_rows,
    "variable_period_costs": variable_period_cost_rows,
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"SKIP missing file: {path}")
        return pd.DataFrame()

    return pd.read_csv(path)


def upsert_rows(supabase, table: str, rows: list[dict[str, Any]], dry_run: bool, batch_size: int = 500) -> None:
    unmapped = sum(1 for row in rows if row.get("property_id") is None and row.get("listing_id"))

    print(f"{table}: rows={len(rows)} unmapped_property={unmapped}")

    if rows:
        sample = rows[0].copy()
        sample.pop("payload", None)
        print(f"  sample={sample}")

    if dry_run or not rows:
        return

    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        supabase.table(table).upsert(batch, on_conflict="row_key").execute()

    print(f"  upserted={len(rows)}")


def sync_one(kind: str, processed_dir: Path, mapper: PropertyMapper, supabase, dry_run: bool) -> None:
    spec = CSV_SPECS[kind]
    csv_path = processed_dir / spec["path"]
    table = spec["table"]
    source_file = str(csv_path.relative_to(ROOT)) if csv_path.is_relative_to(ROOT) else str(csv_path)
    generated_at = datetime.now(timezone.utc).isoformat()

    df = read_csv(csv_path)
    if df.empty:
        print(f"{kind}: no rows")
        return

    builder = BUILDERS[kind]
    rows = builder(df, mapper, source_file, generated_at)
    upsert_rows(supabase, table, rows, dry_run=dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync selected analytics CSVs to Supabase analytics tables.")
    parser.add_argument(
        "--processed-dir",
        default=str(DEFAULT_PROCESSED),
        help="Directory containing processed CSVs.",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        choices=sorted(CSV_SPECS.keys()),
        default=sorted(CSV_SPECS.keys()),
        help="Subset of CSV groups to sync.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print what would be synced without writing.")
    args = parser.parse_args()

    processed_dir = Path(args.processed_dir)
    supabase = get_supabase_client()
    mapper = load_property_mapper(supabase)

    print(f"Processed dir: {processed_dir}")
    print(f"Dry run: {args.dry_run}")
    print(f"Sync groups: {', '.join(args.only)}")

    for kind in args.only:
        print("")
        print("=" * 80)
        print(kind)
        sync_one(kind, processed_dir, mapper, supabase, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
