from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


# Adjust this as needed once we see exact listing labels in the Excel file.
LISTING_MAP = {
    "listing 2": "apt2",
    "listing 4": "apt4",
    "listing 5": "apt5",
    "apt2": "apt2",
    "apt4": "apt4",
    "apt5": "apt5",
    "apartment 2": "apt2",
    "apartment 4": "apt4",
    "apartment 5": "apt5",
    "un jardin sur la mer": "apt2",
    "un balcon sur la mer": "apt4",
    "le refuge sous les toits": "apt5",
    "sous les toits": "apt5",
    "la peskerezh": "peskerezh_house",
    "grande maison de famille avec piscine": "peskerezh_house",
}


DIRECT_SOURCE_TERMS = {
    "direct",
    "manual",
    "manuelle",
    "manuel",
    "website",
    "web site",
    "site",
    "site web",
    "fg web site",
    "beds24",
    "booking page",
    "bookingpage",
    "leboncoin",
    "other",
}


def clean_string(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalize_key(value: Any) -> str:
    return clean_string(value).lower().strip()


def normalize_confirmation(value: Any) -> str:
    text = clean_string(value)
    if not text:
        return ""
    # Avoid turning numeric-looking codes into "123.0"
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
    return text.strip().upper()


def normalize_source(value: Any) -> str:
    text = normalize_key(value)
    text = text.replace("airbnb", "airbnb")
    text = text.replace("air bnb", "airbnb")
    text = text.replace("booking.com", "booking")
    return text


def is_direct_source(value: Any) -> bool:
    source = normalize_source(value)
    return any(term in source for term in DIRECT_SOURCE_TERMS)


def map_listing(value: Any) -> str:
    raw = clean_string(value)
    key = normalize_key(value)

    # Excel often reads listing numbers as floats: 5.0, 4.0, 2.0, 0.0
    try:
        numeric = int(float(raw))
        numeric_map = {
            0: "peskerezh_house",
            2: "apt2",
            4: "apt4",
            5: "apt5",
        }
        if numeric in numeric_map:
            return numeric_map[numeric]
    except (ValueError, TypeError):
        pass

    if key in LISTING_MAP:
        return LISTING_MAP[key]

    for known, mapped in LISTING_MAP.items():
        if known and known in key:
            return mapped

    return ""

def parse_excel_date(value: Any) -> Optional[pd.Timestamp]:
    if pd.isna(value) or value == "":
        return None

    if isinstance(value, pd.Timestamp):
        return value.normalize()

    # Excel serial number fallback, just in case dates come through as numbers.
    if isinstance(value, (int, float)) and value > 20000:
        parsed = pd.to_datetime(value, unit="D", origin="1899-12-30", errors="coerce")
        if not pd.isna(parsed):
            return parsed.normalize()

    # French/European date format: 23/5/2026 = 23 May 2026.
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if not pd.isna(parsed):
        return parsed.normalize()

    return None


def find_column(columns: list[str], candidates: list[str]) -> str:
    normalised = {c.lower().strip(): c for c in columns}
    for candidate in candidates:
        key = candidate.lower().strip()
        if key in normalised:
            return normalised[key]
    raise KeyError(f"Could not find any of columns {candidates}. Available columns: {columns}")


def load_excel_reservations(path: Path, sheet_name: str = "Reservations") -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name=sheet_name)

    # Drop fully empty rows.
    raw = raw.dropna(how="all").copy()

    columns = list(raw.columns)

    col_guest = find_column(columns, ["Guest Name"])
    col_listing = find_column(columns, ["Listing"])
    col_source = find_column(columns, ["Booking Source"])
    col_confirmation = find_column(columns, ["Confirmation Code"])
    col_booking_date = find_column(columns, ["Booking Date"])
    col_checkin = find_column(columns, ["Check in Date", "Check-in Date", "Check In Date"])
    col_nights = find_column(columns, ["Number of Nights", "Nights"])
    col_total_revenue = find_column(columns, ["Total Revenue"])
    col_cleaning = find_column(columns, ["Cleaning Fees", "Cleaning Fee"])
    col_revenue_net = find_column(columns, ["Revenue Net"])

    df = pd.DataFrame()
    df["sheet_guest_name"] = raw[col_guest].map(clean_string)
    df["sheet_listing_raw"] = raw[col_listing].map(clean_string)
    df["listing_id"] = raw[col_listing].map(map_listing)
    df["sheet_booking_source"] = raw[col_source].map(clean_string)
    df["sheet_source_normalized"] = raw[col_source].map(normalize_source)
    df["sheet_confirmation_code"] = raw[col_confirmation].map(normalize_confirmation)
    df["sheet_booking_date"] = raw[col_booking_date].map(parse_excel_date)
    df["arrival"] = raw[col_checkin].map(parse_excel_date)
    df["nights"] = pd.to_numeric(raw[col_nights], errors="coerce").fillna(0).astype(int)
    df["departure"] = df.apply(
        lambda row: row["arrival"] + pd.Timedelta(days=int(row["nights"]))
        if pd.notna(row["arrival"]) else pd.NaT,
        axis=1,
    )

    df["sheet_total_revenue"] = pd.to_numeric(raw[col_total_revenue], errors="coerce").fillna(0).round(2)
    df["sheet_cleaning_fee"] = pd.to_numeric(raw[col_cleaning], errors="coerce").fillna(0).round(2)
    df["sheet_revenue_net"] = pd.to_numeric(raw[col_revenue_net], errors="coerce").fillna(0).round(2)

    df["arrival"] = df["arrival"].dt.date.astype("string")
    df["departure"] = df["departure"].dt.date.astype("string")
    df["is_direct_manual_source"] = raw[col_source].map(is_direct_source)

    df["sheet_match_key"] = (
        df["listing_id"].fillna("")
        + "|"
        + df["arrival"].fillna("")
        + "|"
        + df["nights"].astype(str)
    )

    return df


def load_beds24_reservations(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)

    # Keep cancelled bookings in data, but reconcile separately if needed.
    # For now, include all; status is visible in output.
    df["beds24_confirmation_code"] = (
        df.get("api_reference", pd.Series([""] * len(df))).map(normalize_confirmation)
    )

    # Some rows may have channel references in different fields.
    if "api_reference" in df.columns:
        df["beds24_api_reference"] = df["api_reference"].map(normalize_confirmation)
    else:
        df["beds24_api_reference"] = ""

    df["beds24_source_booking_id"] = df["source_booking_id"].astype(str).map(normalize_confirmation)

    df["beds24_match_key"] = (
        df["listing_id"].fillna("")
        + "|"
        + df["arrival"].fillna("")
        + "|"
        + df["nights"].astype(str)
    )

    df["beds24_host_payout"] = pd.to_numeric(df["host_payout"], errors="coerce").fillna(0).round(2)
    df["beds24_cleaning_fee"] = pd.to_numeric(df["cleaning_fee"], errors="coerce").fillna(0).round(2)

    return df


def best_beds24_match(sheet_row: pd.Series, beds24: pd.DataFrame) -> Optional[pd.Series]:
    confirmation = sheet_row["sheet_confirmation_code"]

    if confirmation:
        candidates = beds24[
            (beds24["beds24_api_reference"] == confirmation)
            | (beds24["beds24_source_booking_id"] == confirmation)
        ]
        if len(candidates) == 1:
            return candidates.iloc[0]
        if len(candidates) > 1:
            # Pick closest by listing/date if duplicated.
            keyed = candidates[candidates["beds24_match_key"] == sheet_row["sheet_match_key"]]
            if len(keyed) >= 1:
                return keyed.iloc[0]
            return candidates.iloc[0]

    candidates = beds24[beds24["beds24_match_key"] == sheet_row["sheet_match_key"]]
    if len(candidates) == 1:
        return candidates.iloc[0]

    if len(candidates) > 1:
        # Pick closest revenue if duplicates exist.
        candidates = candidates.copy()
        candidates["revenue_abs_diff"] = (
            candidates["beds24_host_payout"] - sheet_row["sheet_total_revenue"]
        ).abs()
        return candidates.sort_values("revenue_abs_diff").iloc[0]

    return None


def classify_row(
    sheet_row: pd.Series,
    match: Optional[pd.Series],
    revenue_tolerance: float,
    cleaning_tolerance: float,
) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "match_status": "",
        "revenue_diff": None,
        "cleaning_diff": None,
        "notes": "",
    }

    if match is None:
        if sheet_row["is_direct_manual_source"]:
            result["match_status"] = "EXPECTED_SHEET_ONLY_DIRECT"
            result["notes"] = "Direct/manual reservation in sheet; not expected in Beds24 unless entered manually."
        else:
            result["match_status"] = "MISSING_IN_BEDS24"
            result["notes"] = "OTA/non-direct reservation in sheet but no Beds24 match found."
        return result

    revenue_diff = round(float(match["beds24_host_payout"]) - float(sheet_row["sheet_total_revenue"]), 2)
    cleaning_diff = round(float(match["beds24_cleaning_fee"]) - float(sheet_row["sheet_cleaning_fee"]), 2)

    result["revenue_diff"] = revenue_diff
    result["cleaning_diff"] = cleaning_diff

    revenue_ok = abs(revenue_diff) <= revenue_tolerance
    cleaning_ok = abs(cleaning_diff) <= cleaning_tolerance

    if revenue_ok and cleaning_ok:
        result["match_status"] = "OK"
    elif not revenue_ok and cleaning_ok:
        result["match_status"] = "REVENUE_DIFF"
    elif revenue_ok and not cleaning_ok:
        result["match_status"] = "CLEANING_DIFF"
    else:
        result["match_status"] = "REVENUE_AND_CLEANING_DIFF"

    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--excel",
        default="data/manual/reservations/reservations.xlsx",
        help="Path to the Google Sheet Excel export.",
    )
    parser.add_argument(
        "--beds24",
        default="outputs/processed/normalized_reservations.csv",
        help="Path to normalized Beds24 reservations CSV.",
    )
    parser.add_argument("--sheet-name", default="Reservations")
    parser.add_argument("--revenue-tolerance", type=float, default=0.50)
    parser.add_argument("--cleaning-tolerance", type=float, default=0.50)
    args = parser.parse_args()

    excel_path = ROOT / args.excel
    beds24_path = ROOT / args.beds24

    if not excel_path.exists():
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    if not beds24_path.exists():
        raise FileNotFoundError(f"Beds24 normalized reservations not found: {beds24_path}")

    sheet = load_excel_reservations(excel_path, sheet_name=args.sheet_name)
    beds24 = load_beds24_reservations(beds24_path)

    detail_rows: list[dict[str, Any]] = []
    matched_beds24_ids: set[str] = set()

    for _, sheet_row in sheet.iterrows():
        match = best_beds24_match(sheet_row, beds24)
        classification = classify_row(
            sheet_row,
            match,
            revenue_tolerance=args.revenue_tolerance,
            cleaning_tolerance=args.cleaning_tolerance,
        )

        row = {
            "match_status": classification["match_status"],
            "notes": classification["notes"],
            "listing_id": sheet_row["listing_id"],
            "sheet_listing_raw": sheet_row["sheet_listing_raw"],
            "arrival": sheet_row["arrival"],
            "departure": sheet_row["departure"],
            "nights": sheet_row["nights"],
            "sheet_booking_source": sheet_row["sheet_booking_source"],
            "sheet_confirmation_code": sheet_row["sheet_confirmation_code"],
            "sheet_guest_name": sheet_row["sheet_guest_name"],
            "sheet_total_revenue": sheet_row["sheet_total_revenue"],
            "sheet_cleaning_fee": sheet_row["sheet_cleaning_fee"],
            "sheet_revenue_net": sheet_row["sheet_revenue_net"],
            "beds24_booking_id": None,
            "beds24_status": None,
            "beds24_channel": None,
            "beds24_api_reference": None,
            "beds24_host_payout": None,
            "beds24_cleaning_fee": None,
            "revenue_diff": classification["revenue_diff"],
            "cleaning_diff": classification["cleaning_diff"],
        }

        if match is not None:
            booking_id = str(match["source_booking_id"])
            matched_beds24_ids.add(booking_id)

            row.update(
                {
                    "beds24_booking_id": booking_id,
                    "beds24_status": match.get("status"),
                    "beds24_channel": match.get("channel"),
                    "beds24_api_reference": match.get("api_reference"),
                    "beds24_host_payout": match.get("beds24_host_payout"),
                    "beds24_cleaning_fee": match.get("beds24_cleaning_fee"),
                }
            )

        detail_rows.append(row)

    # Add Beds24 bookings that are not present in the sheet.
    for _, b in beds24.iterrows():
        booking_id = str(b["source_booking_id"])
        beds24_status = str(b.get("status", "")).lower()
        match_status = (
            "CANCELLED_IN_BEDS24_NOT_IN_SHEET"
            if beds24_status == "cancelled"
            else "MISSING_IN_SHEET"
        )
        if booking_id in matched_beds24_ids:
            continue

        detail_rows.append(
            {
                "match_status": match_status,
                "notes": "Beds24 booking not matched to Excel sheet.",
                "listing_id": b.get("listing_id"),
                "sheet_listing_raw": "",
                "arrival": b.get("arrival"),
                "departure": b.get("departure"),
                "nights": b.get("nights"),
                "sheet_booking_source": "",
                "sheet_confirmation_code": "",
                "sheet_guest_name": "",
                "sheet_total_revenue": None,
                "sheet_cleaning_fee": None,
                "sheet_revenue_net": None,
                "beds24_booking_id": booking_id,
                "beds24_status": b.get("status"),
                "beds24_channel": b.get("channel"),
                "beds24_api_reference": b.get("api_reference"),
                "beds24_host_payout": b.get("beds24_host_payout"),
                "beds24_cleaning_fee": b.get("beds24_cleaning_fee"),
                "revenue_diff": None,
                "cleaning_diff": None,
            }
        )

    detail = pd.DataFrame(detail_rows)

    summary = (
        detail.groupby("match_status", dropna=False)
        .agg(
            count=("match_status", "size"),
            sheet_total_revenue=("sheet_total_revenue", "sum"),
            beds24_host_payout=("beds24_host_payout", "sum"),
            sheet_cleaning_fee=("sheet_cleaning_fee", "sum"),
            beds24_cleaning_fee=("beds24_cleaning_fee", "sum"),
        )
        .reset_index()
    )

    for col in [
        "sheet_total_revenue",
        "beds24_host_payout",
        "sheet_cleaning_fee",
        "beds24_cleaning_fee",
    ]:
        summary[col] = pd.to_numeric(summary[col], errors="coerce").fillna(0).round(2)

    out_dir = ROOT / "outputs" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)

    detail_path = out_dir / "reconciliation_detail.csv"
    summary_path = out_dir / "reconciliation_summary.csv"

    detail.to_csv(detail_path, index=False)
    summary.to_csv(summary_path, index=False)

    print(f"Wrote detail reconciliation to {detail_path}")
    print(f"Wrote summary reconciliation to {summary_path}")
    print()
    print(summary.to_string(index=False))

    print()
    print("Non-OK rows:")
    non_ok = detail[detail["match_status"] != "OK"]
    if non_ok.empty:
        print("All matched rows OK.")
    else:
        cols = [
            "match_status",
            "listing_id",
            "arrival",
            "nights",
            "sheet_booking_source",
            "sheet_confirmation_code",
            "sheet_total_revenue",
            "beds24_host_payout",
            "revenue_diff",
            "sheet_cleaning_fee",
            "beds24_cleaning_fee",
            "cleaning_diff",
            "notes",
        ]
        print(non_ok[cols].to_string(index=False))


if __name__ == "__main__":
    main()
