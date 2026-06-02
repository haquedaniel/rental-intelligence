from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]


def load_csv(name: str) -> pd.DataFrame:
    path = ROOT / "outputs" / "processed" / name
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    return pd.read_csv(path)


def fmt_money(value) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"€{float(value):,.0f}".replace(",", " ")
    except Exception:
        return "—"


def fmt_pct(value) -> str:
    try:
        if pd.isna(value):
            return "—"
        return f"{float(value):.1f}%"
    except Exception:
        return "—"


def main() -> None:
    monthly = load_csv("monthly_metrics.csv")
    recs = load_csv("recommendations.csv")

    reports_dir = ROOT / "outputs" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []
    lines.append("# Rental Intelligence Cockpit")
    lines.append("")
    lines.append(f"_Generated: {now}_")
    lines.append("")

    lines.append("## Portfolio snapshot")
    lines.append("")

    if monthly.empty:
        lines.append("No monthly metrics available.")
    else:
        summary = (
            monthly.groupby(["portfolio_id"], dropna=False)
            .agg(
                booked_nights=("booked_nights", "sum"),
                accommodation_revenue=("accommodation_revenue", "sum"),
                cleaning_fee=("cleaning_fee", "sum"),
                tourist_tax=("tourist_tax", "sum"),
                host_payout=("host_payout", "sum"),
                host_payout_minus_cleaning=("host_payout_minus_cleaning", "sum"),
            )
            .reset_index()
        )

        lines.append("| Portfolio | Booked nights | Accommodation | Cleaning | Tourist tax | Host payout | Payout less cleaning |")
        lines.append("|---|---:|---:|---:|---:|---:|---:|")
        for _, row in summary.iterrows():
            lines.append(
                f"| {row['portfolio_id']} "
                f"| {int(row['booked_nights'])} "
                f"| {fmt_money(row['accommodation_revenue'])} "
                f"| {fmt_money(row['cleaning_fee'])} "
                f"| {fmt_money(row['tourist_tax'])} "
                f"| {fmt_money(row['host_payout'])} "
                f"| {fmt_money(row['host_payout_minus_cleaning'])} |"
            )

    lines.append("")
    lines.append("## Monthly metrics")
    lines.append("")

    if monthly.empty:
        lines.append("No monthly metrics available.")
    else:
        cols = [
            "portfolio_id",
            "listing_id",
            "year_month",
            "booked_nights",
            "occupancy_pct",
            "accommodation_revenue",
            "cleaning_fee",
            "tourist_tax",
            "host_payout",
            "adr_accommodation",
        ]

        lines.append("| Portfolio | Listing | Month | Nights | Occ. | Accommodation | Cleaning | Taxe séjour | Host payout | ADR |")
        lines.append("|---|---|---|---:|---:|---:|---:|---:|---:|---:|")
        for _, row in monthly[cols].iterrows():
            lines.append(
                f"| {row['portfolio_id']} "
                f"| {row['listing_id']} "
                f"| {row['year_month']} "
                f"| {int(row['booked_nights'])} "
                f"| {fmt_pct(row['occupancy_pct'])} "
                f"| {fmt_money(row['accommodation_revenue'])} "
                f"| {fmt_money(row['cleaning_fee'])} "
                f"| {fmt_money(row['tourist_tax'])} "
                f"| {fmt_money(row['host_payout'])} "
                f"| {fmt_money(row['adr_accommodation'])} |"
            )

    lines.append("")
    lines.append("## Recommendations")
    lines.append("")

    if recs.empty:
        lines.append("No recommendations generated.")
    else:
        for priority in ["high", "medium", "low"]:
            section = recs[recs["priority"] == priority]
            if section.empty:
                continue

            lines.append(f"### {priority.title()} priority")
            lines.append("")

            for _, row in section.head(20).iterrows():
                suggested_price = row.get("suggested_price")
                price_text = ""
                if pd.notna(suggested_price):
                    price_text = f" Suggested price: {fmt_money(suggested_price)}."

                lines.append(
                    f"- **{row['listing_id']} — {row['category']}** "
                    f"({row['period_start']} → {row['period_end']}): "
                    f"{row['problem']} {row['evidence']} "
                    f"**Action:** {row['suggested_action']}{price_text}"
                )

            lines.append("")

    lines.append("## Notes")
    lines.append("")
    lines.append("- Cancelled bookings are excluded from daily/monthly occupancy and revenue metrics.")
    lines.append("- Booking.com revenue parsing is still less validated than Airbnb/direct bookings.")
    lines.append("- Future pricing/restriction intelligence uses Beds24 offers, not the explicit calendar endpoint.")
    lines.append("- One-night orphan recommendations should be used tactically, not as a universal high-season rule.")
    lines.append("")

    out_path = reports_dir / "cockpit_summary.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote cockpit summary to {out_path}")


if __name__ == "__main__":
    main()
