from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


def load_optional_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def add_issue(
    rows: List[Dict[str, Any]],
    severity: str,
    category: str,
    issue: str,
    details: str,
    affected_count: int | None = None,
) -> None:
    rows.append(
        {
            "severity": severity,
            "category": category,
            "issue": issue,
            "details": details,
            "affected_count": affected_count,
        }
    )


def main() -> None:
    reservations = load_optional_csv("normalized_reservations.csv")
    daily = load_optional_csv("daily_calendar.csv")
    monthly = load_optional_csv("monthly_metrics.csv")
    offers = load_optional_csv("future_offers.csv")
    availability = load_optional_csv("inventory_availability.csv")
    gap_offers = load_optional_csv("gap_offers.csv")

    rows: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Booking / mapping checks
    # ------------------------------------------------------------------
    if reservations.empty:
        add_issue(
            rows,
            "high",
            "bookings",
            "No normalized reservations found",
            "normalized_reservations.csv is missing or empty.",
            None,
        )
    else:
        unmapped = reservations[
            reservations["listing_id"].isna()
            | reservations["portfolio_id"].isna()
            | (reservations["listing_id"].astype(str).str.lower() == "nan")
            | (reservations["portfolio_id"].astype(str).str.lower() == "nan")
        ]

        if not unmapped.empty:
            room_ids = sorted(unmapped["source_room_id"].dropna().astype(str).unique())
            add_issue(
                rows,
                "high",
                "mapping",
                "Bookings with unmapped listing or portfolio",
                f"Unmapped source_room_id values: {', '.join(room_ids)}.",
                len(unmapped),
            )

        bad_nights = reservations[pd.to_numeric(reservations["nights"], errors="coerce") <= 0]
        if not bad_nights.empty:
            add_issue(
                rows,
                "high",
                "bookings",
                "Bookings with zero or negative nights",
                "These bookings should not enter occupancy or revenue metrics.",
                len(bad_nights),
            )

        active = reservations[
            reservations["status"].astype(str).str.lower().isin(["confirmed", "new", "request"])
        ]

        missing_host_payout = active[
            pd.to_numeric(active["host_payout"], errors="coerce").isna()
            | (pd.to_numeric(active["host_payout"], errors="coerce") == 0)
        ]

        if not missing_host_payout.empty:
            add_issue(
                rows,
                "medium",
                "financials",
                "Active bookings with missing or zero host payout",
                "These rows may indicate parser issues, free/test bookings, or incomplete Beds24 financial data.",
                len(missing_host_payout),
            )

        booking_com = active[active["channel"].astype(str).str.lower() == "booking"]
        if not booking_com.empty:
            add_issue(
                rows,
                "medium",
                "financials",
                "Booking.com revenue parsing needs validation",
                "Booking.com rows exist. Confirm whether price, cleaning fee and tourist tax are parsed correctly.",
                len(booking_com),
            )

    # ------------------------------------------------------------------
    # Daily overlap checks
    # ------------------------------------------------------------------
    if not daily.empty:
        duplicates = (
            daily.groupby(["listing_id", "date"], dropna=False)
            .size()
            .reset_index(name="booking_count")
        )
        duplicates = duplicates[duplicates["booking_count"] > 1]

        if not duplicates.empty:
            add_issue(
                rows,
                "high",
                "occupancy",
                "Overlapping active bookings in daily calendar",
                "At least one listing/date has more than one active booked night.",
                len(duplicates),
            )

    # ------------------------------------------------------------------
    # Monthly metric checks
    # ------------------------------------------------------------------
    if not monthly.empty:
        over_100 = monthly[pd.to_numeric(monthly["occupancy_pct"], errors="coerce") > 100]
        if not over_100.empty:
            add_issue(
                rows,
                "high",
                "metrics",
                "Monthly occupancy above 100%",
                "This usually means overlapping bookings or cancelled bookings included in daily calendar.",
                len(over_100),
            )

        zero_accommodation = monthly[
            (pd.to_numeric(monthly["booked_nights"], errors="coerce").fillna(0) > 0)
            & (pd.to_numeric(monthly["accommodation_revenue"], errors="coerce").fillna(0) == 0)
            & (pd.to_numeric(monthly["host_payout"], errors="coerce").fillna(0) == 0)
        ]
        if not zero_accommodation.empty:
            add_issue(
                rows,
                "medium",
                "financials",
                "Booked months with zero revenue and zero payout",
                "Could be free/test bookings or incomplete parsing.",
                len(zero_accommodation),
            )

    # ------------------------------------------------------------------
    # Pricing / availability checks
    # ------------------------------------------------------------------
    if availability.empty:
        add_issue(
            rows,
            "medium",
            "availability",
            "No availability data found",
            "inventory_availability.csv is missing or empty.",
            None,
        )

    if offers.empty:
        add_issue(
            rows,
            "low",
            "pricing",
            "No broad future offers scan found",
            "future_offers.csv is missing or empty. This may be okay if using targeted gap offers only.",
            None,
        )

    if not gap_offers.empty:
        blocked_gaps = gap_offers[gap_offers["bookable"] == False]
        if not blocked_gaps.empty:
            add_issue(
                rows,
                "medium",
                "pricing",
                "Available short gaps are not bookable",
                "Some 1/2/3-night available gaps have no bookable Beds24 offer.",
                len(blocked_gaps),
            )

    # ------------------------------------------------------------------
    # Output
    # ------------------------------------------------------------------
    issues = pd.DataFrame(rows)
    out_dir = ROOT / "outputs" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)

    issues_path = out_dir / "data_quality_issues.csv"
    issues.to_csv(issues_path, index=False)

    report_dir = ROOT / "outputs" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []
    lines.append("# Data Quality Report")
    lines.append("")
    lines.append(f"_Generated: {now}_")
    lines.append("")

    if issues.empty:
        lines.append("✅ No data quality issues detected.")
    else:
        lines.append("| Severity | Category | Issue | Count | Details |")
        lines.append("|---|---|---|---:|---|")

        severity_order = {"high": 1, "medium": 2, "low": 3}
        issues["severity_sort"] = issues["severity"].map(severity_order).fillna(99)
        issues = issues.sort_values(["severity_sort", "category", "issue"])

        for _, row in issues.iterrows():
            count = row["affected_count"]
            count_text = "—" if pd.isna(count) else str(int(count))
            lines.append(
                f"| {row['severity']} "
                f"| {row['category']} "
                f"| {row['issue']} "
                f"| {count_text} "
                f"| {row['details']} |"
            )

    report_path = report_dir / "data_quality_report.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote data quality issues to {issues_path}")
    print(f"Wrote data quality report to {report_path}")

    if issues.empty:
        print("✅ No data quality issues detected.")
    else:
        print()
        print(issues.drop(columns=["severity_sort"], errors="ignore").to_string(index=False))


if __name__ == "__main__":
    main()
