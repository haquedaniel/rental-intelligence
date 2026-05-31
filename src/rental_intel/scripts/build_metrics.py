from __future__ import annotations

from pathlib import Path

import pandas as pd

from rental_intel.metrics.monthly import build_monthly_metrics


ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    daily_path = ROOT / "outputs" / "processed" / "daily_calendar.csv"

    if not daily_path.exists():
        raise FileNotFoundError(
            f"Missing {daily_path}. Run extract_bookings first."
        )

    daily = pd.read_csv(daily_path)

    monthly = build_monthly_metrics(daily)

    out_path = ROOT / "outputs" / "processed" / "monthly_metrics.csv"
    monthly.to_csv(out_path, index=False)

    print(f"Wrote monthly metrics to {out_path}")
    print()
    if not monthly.empty:
        print(monthly.to_string(index=False))


if __name__ == "__main__":
    main()
