from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def main() -> None:
    prices = load_csv("own_price_scenarios.csv")

    if prices.empty:
        raise FileNotFoundError(
            "own_price_scenarios.csv missing or empty. Run extract_own_price_scenarios first."
        )

    df = prices.copy()

    df["bookable"] = df["bookable"].astype(str).str.lower().isin(["true", "1", "yes"])
    df["own_nightly_amount"] = pd.to_numeric(df["own_nightly_amount"], errors="coerce")

    summary = (
        df.groupby(
            [
                "portfolio_id",
                "market_set_id",
                "listing_id",
                "scenario_id",
            ],
            dropna=False,
        )
        .agg(
            windows_checked=("check_in", "count"),
            bookable_windows=("bookable", "sum"),
            median_own_nightly=("own_nightly_amount", "median"),
            min_own_nightly=("own_nightly_amount", "min"),
            max_own_nightly=("own_nightly_amount", "max"),
        )
        .reset_index()
    )

    summary["unavailable_windows"] = (
        summary["windows_checked"] - summary["bookable_windows"]
    )

    summary["own_availability_rate"] = (
        summary["bookable_windows"] / summary["windows_checked"] * 100
    ).round(1)

    money_cols = [
        "median_own_nightly",
        "min_own_nightly",
        "max_own_nightly",
    ]

    for col in money_cols:
        summary[col] = pd.to_numeric(summary[col], errors="coerce").round(2)

    out_path = PROCESSED / "own_price_scenario_summary.csv"
    summary.to_csv(out_path, index=False)

    print(f"Wrote own price scenario summary to {out_path}")
    print()
    print(summary.to_string(index=False))


if __name__ == "__main__":
    main()
