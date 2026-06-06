from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = ROOT / "outputs" / "logs"


FULL_PIPELINE = [
    "rental_intel.scripts.extract_bookings",
    "rental_intel.scripts.build_metrics",
    "rental_intel.scripts.build_profitability",
    "rental_intel.scripts.build_portfolio_profitability",
    "rental_intel.scripts.build_variable_period_costs",
    "rental_intel.scripts.build_financial_views",
    "rental_intel.scripts.build_dashboard_kpis",
    "rental_intel.scripts.extract_availability",
    "rental_intel.scripts.extract_gap_offers",
    "rental_intel.scripts.build_forward_position",
    "rental_intel.scripts.build_recommendations",
    "rental_intel.scripts.build_data_quality_report",
]

FINANCIAL_ONLY = [
    "rental_intel.scripts.build_metrics",
    "rental_intel.scripts.build_profitability",
    "rental_intel.scripts.build_portfolio_profitability",
    "rental_intel.scripts.build_variable_period_costs",
    "rental_intel.scripts.build_financial_views",
    "rental_intel.scripts.build_dashboard_kpis",
    "rental_intel.scripts.build_data_quality_report",
]

NO_API = [
    "rental_intel.scripts.build_metrics",
    "rental_intel.scripts.build_profitability",
    "rental_intel.scripts.build_portfolio_profitability",
    "rental_intel.scripts.build_variable_period_costs",
    "rental_intel.scripts.build_financial_views",
    "rental_intel.scripts.build_dashboard_kpis",
    "rental_intel.scripts.build_forward_position",
    "rental_intel.scripts.build_recommendations",
    "rental_intel.scripts.build_data_quality_report",
]


def run_module(module: str, log_file: Path) -> None:
    started = datetime.now(timezone.utc).isoformat()
    msg = f"\n\n===== {started} running {module} =====\n"
    print(msg)

    with log_file.open("a", encoding="utf-8") as f:
        f.write(msg)
        f.flush()

        result = subprocess.run(
            [sys.executable, "-m", module],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        f.write(result.stdout)
        f.flush()

    print(result.stdout)

    if result.returncode != 0:
        raise RuntimeError(f"Pipeline step failed: {module}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--financial-only",
        action="store_true",
        help="Rebuild financial outputs only; does not call Beds24 availability/offers.",
    )
    parser.add_argument(
        "--no-api",
        action="store_true",
        help="Use existing extracted CSVs; do not call Beds24 APIs.",
    )
    args = parser.parse_args()

    if args.financial_only and args.no_api:
        raise ValueError("Choose only one of --financial-only or --no-api")

    if args.financial_only:
        steps = FINANCIAL_ONLY
        mode = "financial_only"
    elif args.no_api:
        steps = NO_API
        mode = "no_api"
    else:
        steps = FULL_PIPELINE
        mode = "full"

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_file = LOG_DIR / f"pipeline_{mode}_{timestamp}.log"

    print(f"Running {mode} pipeline")
    print(f"Log file: {log_file}")

    for module in steps:
        run_module(module, log_file)

    completed_path = ROOT / "outputs" / "processed" / "last_refresh.txt"
    completed_path.parent.mkdir(parents=True, exist_ok=True)
    completed_path.write_text(
        datetime.now(timezone.utc).isoformat(),
        encoding="utf-8",
    )

    print("\nPipeline completed successfully.")


if __name__ == "__main__":
    main()
