from __future__ import annotations

import argparse
import json

from rental_intel.pricing.publisher import publish_pending, retry_failed


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish and validate queued Pilotys prices.")
    parser.add_argument("--property-id")
    parser.add_argument("--date", help="Publish exactly one queued date (YYYY-MM-DD).")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args()

    if args.date and not args.property_id:
        raise SystemExit("--date requires --property-id")
    if args.retry_failed:
        if not args.property_id:
            raise SystemExit("--retry-failed requires --property-id")
        print(f"Actions reset for retry: {retry_failed(args.property_id)}")

    try:
        summary = publish_pending(
            property_id=args.property_id,
            limit=1 if args.date else args.limit,
            dry_run=args.dry_run,
            target_date=args.date,
        )
    except (RuntimeError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc

    print(json.dumps(summary.as_dict(), indent=2))


if __name__ == "__main__":
    main()
