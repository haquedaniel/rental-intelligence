from __future__ import annotations

from pathlib import Path

import pandas as pd

import numpy as np


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def pct_gap(own: float | None, market: float | None) -> float | None:
    if own is None or market is None or pd.isna(own) or pd.isna(market) or market == 0:
        return None
    return round((own - market) / market * 100, 1)


def latest_market_snapshots(market: pd.DataFrame) -> pd.DataFrame:
    if market.empty:
        return market

    df = market.copy()

    # Ensure these exist even if older CSVs are missing columns.
    for col in [
        "competitor_id",
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "adults",
        "children",
        "scraped_at",
        "run_id",
    ]:
        if col not in df.columns:
            df[col] = None

    df["scraped_at_sort"] = pd.to_datetime(
        df["scraped_at"],
        errors="coerce",
        utc=True,
    )

    # Fallback if scraped_at is missing.
    df["run_id_sort"] = df["run_id"].astype(str)

    keys = [
        "competitor_id",
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "adults",
        "children",
    ]

    df = df.sort_values(
        ["scraped_at_sort", "run_id_sort"],
        ascending=True,
        na_position="first",
    )

    latest = df.drop_duplicates(
        subset=keys,
        keep="last",
    ).copy()

    latest = latest.drop(columns=["scraped_at_sort", "run_id_sort"], errors="ignore")

    return latest

def market_tension_label(
    availability_rate: float | None,
    usable_competitors: int,
    failed_competitors: int,
) -> str:
    if usable_competitors == 0:
        if failed_competitors > 0:
            return "technical_failure"
        return "insufficient_sample"

    if usable_competitors < 2:
        return "thin_sample"

    if availability_rate is None or pd.isna(availability_rate):
        return "insufficient_sample"

    # availability_rate is a percentage: 0.0, 25.0, 50.0, 75.0...
    if availability_rate <= 25:
        return "tight_market"

    if availability_rate <= 50:
        return "moderate_market"

    return "open_market"

def price_position(gap: float | None) -> str:
    if gap is None or pd.isna(gap):
        return "no_comparison"

    if gap <= -15:
        return "well_below_market"
    if gap <= -5:
        return "below_market"
    if gap < 5:
        return "near_market"
    if gap < 15:
        return "above_market"

    return "well_above_market"


def guidance_from_position(
    position: str,
    own_bookable: bool,
    market_available_count: int,
    market_unavailable_count: int = 0,
    market_tension: str = "",
) -> str:
    if not own_bookable and market_available_count > 0:
        return (
            "Our listing is not bookable while competitors are available. "
            "Check restrictions, calendar blocks, or rates."
        )

    if not own_bookable and market_unavailable_count > 0 and market_available_count == 0:
        return (
            "Our listing is not bookable and sampled competitors are also unavailable. "
            "This may simply confirm a high-demand/booked period."
        )

    if position == "no_comparison":
        if market_tension == "tight_market":
            return (
                "No available competitor price, but sampled competitors are unavailable. "
                "Market appears tight; avoid early discounting."
            )

        if market_tension == "moderate_market":
            return (
                "Limited competitor price data. Market availability is mixed; review manually before changing price."
            )

        if market_tension == "open_market":
            return (
                "Competitors are available but price comparison is limited. Monitor carefully before increasing."
            )

        return "No reliable benchmark available yet."

    if position == "well_below_market":
        if market_tension == "tight_market":
            return (
                "Our price appears well below market and availability is tight. "
                "Consider increasing or holding firm."
            )
        return "Our price appears well below the adjusted competitor benchmark. Consider increasing if occupancy/risk signals allow."

    if position == "below_market":
        return "Our price is below the adjusted competitor benchmark. Hold price or test a moderate increase on attractive dates."

    if position == "near_market":
        return "Our price is close to the adjusted competitor benchmark. Current positioning looks broadly coherent."

    if position == "above_market":
        if market_tension == "tight_market":
            return "Our price is above market, but availability appears tight. This may be acceptable; monitor booking pickup."
        return "Our price is above the adjusted competitor benchmark. Acceptable if demand is strong; monitor availability."

    if position == "well_above_market":
        if market_tension == "tight_market":
            return "Our price is well above available benchmarks, but sampled availability is tight. Review quality/comparability before reducing."
        return "Our price is well above the adjusted competitor benchmark. Check whether this is justified by quality/location or risks suppressing demand."

    return "No reliable benchmark available yet."


def main() -> None:
    own = load_csv("own_price_scenarios.csv")
    market = load_csv("market_price_snapshots.csv")

    if market.empty:
        market = load_csv("market_price_snapshots_latest.csv")

    if own.empty:
        raise FileNotFoundError("own_price_scenarios.csv missing or empty. Run extract_own_price_scenarios first.")

    if market.empty:
        print("No market_price_snapshots.csv or market_price_snapshots_latest.csv found. Writing empty benchmark.")
        out = pd.DataFrame()
        out.to_csv(PROCESSED / "market_benchmark_latest.csv", index=False)
        return

    own = own.copy()
    market = market.copy()

    market = latest_market_snapshots(market)

    own["bookable"] = own["bookable"].astype(str).str.lower().isin(["true", "1", "yes"])
    market["available"] = market["available"].astype(str).str.lower().isin(["true", "1", "yes"])

    own["own_nightly_amount"] = pd.to_numeric(own["own_nightly_amount"], errors="coerce")
    own["own_total_amount"] = pd.to_numeric(own["own_total_amount"], errors="coerce")

    market["nightly_amount"] = pd.to_numeric(market["nightly_amount"], errors="coerce")
    market["total_amount"] = pd.to_numeric(market["total_amount"], errors="coerce")
    market["expected_price_index"] = pd.to_numeric(
        market.get("expected_price_index", 1.0),
        errors="coerce",
    ).fillna(1.0)

    market["guest_price_to_comparable_factor"] = pd.to_numeric(
        market.get("guest_price_to_comparable_factor", 1.0),
        errors="coerce",
    ).fillna(1.0)

    market["scraped_competitor_nightly"] = pd.to_numeric(
        market["nightly_amount"],
        errors="coerce",
    )

    market["normalised_competitor_nightly"] = (
        market["scraped_competitor_nightly"]
        * market["guest_price_to_comparable_factor"]
        / market["expected_price_index"]
    ).round(2)

    # Backwards-compatible name used by the rest of the script
    market["adjusted_competitor_nightly"] = market["normalised_competitor_nightly"]

    join_keys = [
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "adults",
        "children",
    ]

    own_cols = [
        "run_id",
        "retrieved_at",
        "portfolio_id",
        "market_set_id",
        "listing_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "adults",
        "children",
        "status",
        "bookable",
        "own_total_amount",
        "own_nightly_amount",
        "warning",
    ]

    own_cols = [c for c in own_cols if c in own.columns]

    market["status"] = market["status"].astype(str)

    if "error_type" not in market.columns:
        market["error_type"] = ""

    market["error_type"] = market["error_type"].fillna("").astype(str)

    market["is_available_signal"] = (
        market["status"].eq("success_available")
        & market["available"]
    )

    market["is_unavailable_signal"] = (
        market["status"].eq("success_unavailable")
        | market["error_type"].eq("property_unavailable")
    )

    market["is_failed_signal"] = (
        market["status"].eq("failed_scrape")
        | market["status"].eq("dry_run")
    )

    market_available = market[
        market["is_available_signal"]
        & market["adjusted_competitor_nightly"].notna()
    ].copy()

    availability_summary = (
        market.groupby(join_keys, dropna=False)
        .agg(
            competitors_checked=("competitor_id", "nunique"),
            competitors_available=("is_available_signal", "sum"),
            competitors_unavailable=("is_unavailable_signal", "sum"),
            competitors_failed=("is_failed_signal", "sum"),
        )
        .reset_index()
    )

    availability_summary["competitors_usable"] = (
        availability_summary["competitors_available"]
        + availability_summary["competitors_unavailable"]
    )

    usable = availability_summary["competitors_usable"].replace(0, np.nan)

    availability_summary["market_availability_rate"] = (
        availability_summary["competitors_available"] / usable * 100
    ).round(1)

    availability_summary["market_unavailable_rate"] = (
        availability_summary["competitors_unavailable"] / usable * 100
    ).round(1)

    availability_summary["market_tension"] = [
        market_tension_label(rate, usable, failed)
        for rate, usable, failed in zip(
            availability_summary["market_availability_rate"],
            availability_summary["competitors_usable"],
            availability_summary["competitors_failed"],
        )
    ]

    if market_available.empty:
        price_summary = pd.DataFrame(columns=join_keys)
    else:
        price_summary = (
            market_available.groupby(join_keys, dropna=False)
            .agg(
                competitor_scraped_median_nightly=("scraped_competitor_nightly", "median"),
                competitor_normalised_median_nightly=("normalised_competitor_nightly", "median"),
                competitor_adjusted_median_nightly=("adjusted_competitor_nightly", "median"),
                competitor_adjusted_p25_nightly=("adjusted_competitor_nightly", lambda s: s.quantile(0.25)),
                competitor_adjusted_p75_nightly=("adjusted_competitor_nightly", lambda s: s.quantile(0.75)),
                competitor_min_nightly=("adjusted_competitor_nightly", "min"),
                competitor_max_nightly=("adjusted_competitor_nightly", "max"),
            )
            .reset_index()
        )

    market_summary = availability_summary.merge(
        price_summary,
        on=join_keys,
        how="left",
    )

    benchmark = own[own_cols].merge(
        market_summary,
        on=join_keys,
        how="left",
    )

    count_cols = [
        "competitors_checked",
        "competitors_available",
        "competitors_unavailable",
        "competitors_failed",
        "competitors_usable",
    ]

    for col in count_cols:
        if col in benchmark.columns:
            benchmark[col] = benchmark[col].fillna(0).astype(int)

    if "market_tension" not in benchmark.columns:
        benchmark["market_tension"] = "no_market_data"
    else:
        benchmark["market_tension"] = benchmark["market_tension"].fillna("no_market_data")

    benchmark["own_vs_adjusted_market_pct"] = [
        pct_gap(own_price, market_price)
        for own_price, market_price in zip(
            benchmark["own_nightly_amount"],
            benchmark["competitor_adjusted_median_nightly"],
        )
    ]

    benchmark["price_position"] = benchmark["own_vs_adjusted_market_pct"].apply(price_position)

    benchmark["pricing_guidance"] = [
        guidance_from_position(position, bool(bookable), int(avail), int(unavail), tension)
        for position, bookable, avail, unavail, tension in zip(
            benchmark["price_position"],
            benchmark["bookable"],
            benchmark["competitors_available"],
            benchmark["competitors_unavailable"],
            benchmark["market_tension"],
        )
    ]

    money_cols = [
        "own_total_amount",
        "own_nightly_amount",
        "competitor_scraped_median_nightly",
        "competitor_normalised_median_nightly",
        "competitor_adjusted_median_nightly",
        "competitor_adjusted_p25_nightly",
        "competitor_adjusted_p75_nightly",
        "competitor_min_nightly",
        "competitor_max_nightly",
        "market_availability_rate",
        "market_unavailable_rate",
    ]

    for col in money_cols:
        if col in benchmark.columns:
            benchmark[col] = pd.to_numeric(benchmark[col], errors="coerce").round(2)

    out_path = PROCESSED / "market_benchmark_latest.csv"
    benchmark.to_csv(out_path, index=False)

    print(f"Wrote market benchmark to {out_path}")
    print()

    preview_cols = [
        "portfolio_id",
        "listing_id",
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "bookable",
        "own_nightly_amount",
        "competitors_checked",
        "competitors_available",
        "competitors_unavailable",
        "competitors_failed",
        "market_availability_rate",
        "market_tension",
        "competitor_scraped_median_nightly",
        "competitor_normalised_median_nightly",
        "own_vs_adjusted_market_pct",
        "price_position",
        "pricing_guidance",
    ]

    preview_cols = [c for c in preview_cols if c in benchmark.columns]

    print(benchmark[preview_cols].to_string(index=False))


if __name__ == "__main__":
    main()
