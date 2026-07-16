from __future__ import annotations

import argparse
import json
from rental_intel.cleaning.db import get_supabase_client
from rental_intel.pricing.engine import regenerate


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate Pilotys pricing calendars.")
    parser.add_argument("--property-id")
    parser.add_argument("--created-by", default="daily_pricing")
    args = parser.parse_args()

    if args.property_id:
        results = [regenerate(args.property_id, args.created_by, "Recalcul automatique")]
    else:
        db = get_supabase_client()
        settings = (
            db.table("pricing_property_settings")
            .select("property_id")
            .eq("enabled", True)
            .execute()
            .data
            or []
        )
        results = []
        for row in settings:
            try:
                results.append(regenerate(str(row["property_id"]), args.created_by, "Recalcul quotidien automatique"))
            except Exception as exc:
                results.append({"property_id": row["property_id"], "error": str(exc)})
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
