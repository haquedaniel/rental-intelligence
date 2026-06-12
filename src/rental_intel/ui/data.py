from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


def read_processed_csv(filename: str) -> pd.DataFrame:
    path = PROCESSED / filename
    if not path.exists():
        return pd.DataFrame()

    return pd.read_csv(path)


def ensure_columns(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    df = df.copy()
    for col in columns:
        if col not in df.columns:
            df[col] = pd.NA
    return df


def to_bool_series(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().isin(["true", "1", "yes"])


def latest_by_keys(
    df: pd.DataFrame,
    keys: list[str],
    time_cols: list[str] | None = None,
) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()

    time_cols = time_cols or ["scraped_at", "retrieved_at", "run_id"]
    existing_time_cols = [c for c in time_cols if c in df.columns]

    if existing_time_cols:
        df = df.sort_values(existing_time_cols)

    existing_keys = [k for k in keys if k in df.columns]

    if not existing_keys:
        return df

    return df.drop_duplicates(subset=existing_keys, keep="last")


def load_market_benchmark() -> pd.DataFrame:
    df = read_processed_csv("market_benchmark_latest.csv")

    if df.empty:
        return df

    numeric_cols = [
        "own_nightly_amount",
        "competitor_normalised_median_nightly",
        "competitor_scraped_median_nightly",
        "own_vs_adjusted_market_pct",
        "competitors_checked",
        "competitors_available",
        "competitors_unavailable",
        "competitors_failed",
        "market_availability_rate",
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "bookable" in df.columns:
        df["bookable"] = to_bool_series(df["bookable"])

    return df


def load_market_snapshots_latest() -> pd.DataFrame:
    df = read_processed_csv("market_price_snapshots.csv")

    if df.empty:
        df = read_processed_csv("market_price_snapshots_latest.csv")

    if df.empty:
        return df

    df = ensure_columns(
        df,
        [
            "competitor_id",
            "market_set_id",
            "scenario_id",
            "check_in",
            "check_out",
            "nights",
            "adults",
            "children",
            "available",
            "status",
            "source",
            "airbnb_id",
            "nightly_amount",
            "expected_price_index",
            "guest_price_to_comparable_factor",
        ],
    )

    df["available"] = to_bool_series(df["available"])
    df["nightly_amount"] = pd.to_numeric(df["nightly_amount"], errors="coerce")
    df["expected_price_index"] = pd.to_numeric(
        df["expected_price_index"], errors="coerce"
    ).fillna(1.0)
    df["guest_price_to_comparable_factor"] = pd.to_numeric(
        df["guest_price_to_comparable_factor"], errors="coerce"
    ).fillna(1.0)

    df["normalised_competitor_nightly"] = (
        df["nightly_amount"]
        * df["guest_price_to_comparable_factor"]
        / df["expected_price_index"]
    ).round(2)

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

    return latest_by_keys(df, keys=keys, time_cols=["scraped_at", "run_id"])


def load_own_prices_latest() -> pd.DataFrame:
    df = read_processed_csv("own_price_scenarios_history.csv")

    if df.empty:
        df = read_processed_csv("own_price_scenarios.csv")

    if df.empty:
        return df

    df = ensure_columns(
        df,
        [
            "listing_id",
            "portfolio_id",
            "market_set_id",
            "scenario_id",
            "check_in",
            "check_out",
            "nights",
            "adults",
            "children",
            "bookable",
            "own_nightly_amount",
        ],
    )

    df["bookable"] = to_bool_series(df["bookable"])
    df["own_nightly_amount"] = pd.to_numeric(df["own_nightly_amount"], errors="coerce")

    keys = [
        "listing_id",
        "market_set_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "adults",
        "children",
    ]

    return latest_by_keys(df, keys=keys, time_cols=["retrieved_at", "run_id"])


def load_goyen_daily_latest() -> pd.DataFrame:
    df = read_processed_csv("market_daily_price_snapshots.csv")

    if df.empty:
        df = read_processed_csv("market_daily_price_snapshots_latest.csv")

    if df.empty:
        return df

    df = ensure_columns(
        df,
        [
            "competitor_id",
            "date",
            "available",
            "price",
            "source",
            "market_set_id",
            "scraped_at",
            "run_id",
        ],
    )

    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["available"] = to_bool_series(df["available"])

    return latest_by_keys(
        df,
        keys=["competitor_id", "date"],
        time_cols=["scraped_at", "run_id"],
    )


def get_airbnb_url(airbnb_id: object) -> str | None:
    if pd.isna(airbnb_id):
        return None

    text = str(airbnb_id).strip()

    if not text:
        return None

    if text.endswith(".0"):
        text = text[:-2]

    return f"https://www.airbnb.com/rooms/{text}"