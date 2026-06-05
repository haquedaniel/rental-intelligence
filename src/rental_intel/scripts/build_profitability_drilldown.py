from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def money(value) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"€{float(value):,.2f}".replace(",", " ")
    except Exception:
        return "—"


def main() -> None:
    reservations = load_csv("normalized_reservations.csv")
    booking_expenses = load_csv("booking_expenses.csv")
    fixed_expenses = load_csv("fixed_expenses.csv")
    profitability = load_csv("monthly_profitability.csv")

    out_dir = ROOT / "outputs" / "reports" / "drilldowns"
    out_dir.mkdir(parents=True, exist_ok=True)

    if profitability.empty:
        raise FileNotFoundError("monthly_profitability.csv missing or empty. Run build_profitability first.")

    active_statuses = {"confirmed", "new", "request"}

    if not reservations.empty:
        reservations = reservations[
            reservations["status"].astype(str).str.lower().isin(active_statuses)
        ].copy()
        reservations["year_month"] = pd.to_datetime(reservations["arrival"]).dt.strftime("%Y-%m")

    for _, row in profitability.iterrows():
        portfolio_id = str(row["portfolio_id"])
        listing_id = str(row["listing_id"])
        year_month = str(row["year_month"])

        lines: list[str] = []

        lines.append(f"# Profitability drill-down — {portfolio_id} / {listing_id} / {year_month}")
        lines.append("")

        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Amount |")
        lines.append("|---|---:|")

        summary_cols = [
            ("gross_booking_value", "Gross booking value"),
            ("accommodation_revenue", "Accommodation revenue"),
            ("cleaning_fee", "Cleaning fee charged to guest"),
            ("tourist_tax", "Tourist tax"),
            ("channel_commission", "Channel commission"),
            ("host_payout", "Host payout"),
            ("host_payout_minus_cleaning", "Host payout less cleaning charged"),
            ("booking_associated_costs", "Booking-associated costs"),
            ("fixed_allocated_costs", "Fixed allocated costs"),
            ("estimated_operating_profit", "Estimated operating profit"),
        ]

        for col, label in summary_cols:
            if col in row.index:
                lines.append(f"| {label} | {money(row[col])} |")

        lines.append("")

        # ------------------------------------------------------------
        # Booking revenue detail
        # ------------------------------------------------------------
        lines.append("## Booking revenue detail")
        lines.append("")

        res = pd.DataFrame()
        if not reservations.empty:
            res = reservations[
                (reservations["portfolio_id"].astype(str) == portfolio_id)
                & (reservations["listing_id"].astype(str) == listing_id)
                & (reservations["year_month"].astype(str) == year_month)
            ].copy()

        if res.empty:
            lines.append("No active bookings found for this listing/month.")
        else:
            lines.append("| Booking ID | Channel | Arrival | Departure | Nights | Accommodation | Cleaning charged | Tourist tax | Commission | Host payout | API ref |")
            lines.append("|---|---|---|---|---:|---:|---:|---:|---:|---:|---|")

            for _, b in res.iterrows():
                lines.append(
                    f"| {b.get('source_booking_id')} "
                    f"| {b.get('channel')} "
                    f"| {b.get('arrival')} "
                    f"| {b.get('departure')} "
                    f"| {int(b.get('nights', 0))} "
                    f"| {money(b.get('accommodation_revenue'))} "
                    f"| {money(b.get('cleaning_fee'))} "
                    f"| {money(b.get('tourist_tax'))} "
                    f"| {money(b.get('channel_commission'))} "
                    f"| {money(b.get('host_payout'))} "
                    f"| {b.get('api_reference', '')} |"
                )

        lines.append("")

        # ------------------------------------------------------------
        # Booking expenses detail
        # ------------------------------------------------------------
        lines.append("## Booking-associated expense detail")
        lines.append("")

        be = pd.DataFrame()
        if not booking_expenses.empty:
            be = booking_expenses[
                (booking_expenses["portfolio_id"].astype(str) == portfolio_id)
                & (booking_expenses["listing_id"].astype(str) == listing_id)
                & (booking_expenses["year_month"].astype(str) == year_month)
            ].copy()

        if be.empty:
            lines.append("No booking-associated expenses found for this listing/month.")
        else:
            lines.append("| Booking ID | Category | Rule | Calculation | Arrival | Nights | Channel | Amount |")
            lines.append("|---|---|---|---|---|---:|---|---:|")

            for _, e in be.iterrows():
                lines.append(
                    f"| {e.get('source_booking_id')} "
                    f"| {e.get('category')} "
                    f"| {e.get('rule_id')} "
                    f"| {e.get('calculation_type')} "
                    f"| {e.get('arrival')} "
                    f"| {int(e.get('nights', 0))} "
                    f"| {e.get('channel')} "
                    f"| {money(e.get('expense_amount'))} |"
                )

            lines.append("")
            lines.append("### Booking-associated expense totals")
            lines.append("")
            totals = be.groupby("category")["expense_amount"].sum().reset_index()
            lines.append("| Category | Amount |")
            lines.append("|---|---:|")
            for _, t in totals.iterrows():
                lines.append(f"| {t['category']} | {money(t['expense_amount'])} |")

        lines.append("")

        # ------------------------------------------------------------
        # Fixed expense detail
        # ------------------------------------------------------------
        lines.append("## Fixed / allocated expense detail")
        lines.append("")

        fe = pd.DataFrame()
        if not fixed_expenses.empty:
            fe = fixed_expenses[
                (fixed_expenses["portfolio_id"].astype(str) == portfolio_id)
                & (
                    (fixed_expenses["listing_id"].astype(str) == listing_id)
                    | (fixed_expenses["listing_id"].isna())
                )
                & (fixed_expenses["year_month"].astype(str) == year_month)
            ].copy()

        if fe.empty:
            lines.append("No fixed/allocated expenses found for this listing/month.")
        else:
            lines.append("| Category | Rule | Calculation | Allocation | Amount |")
            lines.append("|---|---|---|---|---:|")

            for _, e in fe.iterrows():
                lines.append(
                    f"| {e.get('category')} "
                    f"| {e.get('rule_id')} "
                    f"| {e.get('calculation_type')} "
                    f"| {e.get('allocation_method')} "
                    f"| {money(e.get('expense_amount'))} |"
                )

            lines.append("")
            lines.append("### Fixed expense totals")
            lines.append("")
            totals = fe.groupby("category")["expense_amount"].sum().reset_index()
            lines.append("| Category | Amount |")
            lines.append("|---|---:|")
            for _, t in totals.iterrows():
                lines.append(f"| {t['category']} | {money(t['expense_amount'])} |")

        lines.append("")
        lines.append("## Notes")
        lines.append("")
        lines.append("- Cleaning fee charged to guest comes from Beds24/OTA booking data.")
        lines.append("- Cleaning actual cost comes from the expense rules YAML.")
        lines.append("- Fixed costs come from the expense rules YAML and may be allocated by rule.")
        lines.append("- Concierge fees are calculated only where expense-rule filters match date, listing and channel.")
        lines.append("")

        safe_name = f"{portfolio_id}_{listing_id}_{year_month}.md".replace("/", "_")
        out_path = out_dir / safe_name
        out_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote profitability drill-downs to {out_dir}")


if __name__ == "__main__":
    main()
