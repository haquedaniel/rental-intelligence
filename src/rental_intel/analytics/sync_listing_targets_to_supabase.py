from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from rental_intel.cleaning.db import get_supabase_client


def repo_root() -> Path:
    here = Path.cwd()
    for p in [here, *here.parents]:
        if (p / "config" / "clients").exists() and (p / "outputs").exists():
            return p
    return here


def clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def load_listing_metadata(root: Path) -> dict[str, dict[str, Any]]:
    path = root / "outputs" / "processed" / "listing_month_financials.csv"
    if not path.exists():
        return {}

    df = pd.read_csv(path)
    keep = [
        "client_id",
        "portfolio_id",
        "portfolio_name",
        "listing_id",
        "listing_name",
    ]
    keep = [c for c in keep if c in df.columns]

    meta: dict[str, dict[str, Any]] = {}
    for _, row in df[keep].drop_duplicates("listing_id").iterrows():
        listing_id = str(row["listing_id"])
        meta[listing_id] = {k: clean_value(row[k]) for k in keep}
    return meta


def load_property_map(supabase) -> dict[str, str]:
    result = (
        supabase.table("property_source_links")
        .select("property_id,source_listing_id,source_property_id,source_room_id,active")
        .eq("active", True)
        .execute()
    )

    out: dict[str, str] = {}
    for row in result.data or []:
        property_id = row.get("property_id")
        if not property_id:
            continue

        for key in [
            row.get("source_listing_id"),
            row.get("source_property_id"),
            row.get("source_room_id"),
        ]:
            if key:
                out[str(key)] = property_id

    # Current historical alias.
    if "peskerezh" in out and "peskerezh_house" not in out:
        out["peskerezh_house"] = out["peskerezh"]
    if "peskerezh_house" in out and "peskerezh" not in out:
        out["peskerezh"] = out["peskerezh_house"]

    return out


def rows_from_yaml(root: Path, client_id: str, supabase) -> list[dict[str, Any]]:
    source_path = root / "config" / "clients" / f"{client_id}_targets.yaml"
    if not source_path.exists():
        raise FileNotFoundError(source_path)

    data = yaml.safe_load(source_path.read_text()) or {}
    listing_meta = load_listing_metadata(root)
    property_map = load_property_map(supabase)

    occupancy_default = ((data.get("occupancy_targets") or {}).get("default") or {})

    rows: list[dict[str, Any]] = []

    for month_item in data.get("monthly_targets", []) or []:
        year_month = str(month_item.get("year_month"))
        month_number = int(year_month.split("-")[1])
        occupancy_target = occupancy_default.get(month_number, occupancy_default.get(str(month_number)))

        for listing_id, target in (month_item.get("targets") or {}).items():
            listing_id = str(listing_id)
            meta = listing_meta.get(listing_id, {})

            portfolio_id = meta.get("portfolio_id")
            portfolio_name = meta.get("portfolio_name")
            listing_name = meta.get("listing_name")

            amount = float(target or 0)

            rows.append(
                {
                    "row_key": f"target:{client_id}:{portfolio_id or 'unknown'}:{listing_id}:{year_month}",
                    "client_id": client_id,
                    "portfolio_id": portfolio_id,
                    "portfolio_name": portfolio_name,
                    "listing_id": listing_id,
                    "listing_name": listing_name,
                    "property_id": property_map.get(listing_id),
                    "year_month": year_month,
                    # The YAML target is the seasonal revenue objective used by the old cockpit.
                    # Keep both names for now so the UI can compare gross CA while old code can still use host_payout naming.
                    "target_gross_booking_value": amount,
                    "target_host_payout": amount,
                    "target_after_variables": None,
                    "target_after_fixes": None,
                    "occupancy_target_pct": float(occupancy_target) if occupancy_target is not None else None,
                    "payload": {
                        "source_listing_id": listing_id,
                        "yaml_target_name": "monthly_targets",
                    },
                    "source_file": str(source_path.relative_to(root)),
                }
            )

    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id", default="daniel_aurore")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = repo_root()
    supabase = get_supabase_client()
    rows = rows_from_yaml(root, args.client_id, supabase)

    unmapped = sum(1 for r in rows if not r.get("property_id"))

    print(f"listing_month_targets rows={len(rows)} unmapped_property={unmapped}")
    if rows:
        print("sample", rows[0])

    if args.dry_run:
        return

    if rows:
        supabase.table("analytics_listing_month_targets").upsert(
            rows,
            on_conflict="row_key",
        ).execute()


if __name__ == "__main__":
    main()
