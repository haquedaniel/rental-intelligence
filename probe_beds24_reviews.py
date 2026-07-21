#!/usr/bin/env python3
"""Non-destructive Beds24 review API probe.

This script does not modify Pilotys or Beds24. It uses the existing
Beds24Client only for authentication and GET requests, tries a small set of
plausible review requests, and writes a redacted JSON report.

Run inside the cockpit container, for example:
  python scripts/probe_beds24_reviews.py --property-id 330389 \
    --output /tmp/beds24-review-probe.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

try:
    from rental_intel.ingest.beds24 import Beds24Client
except Exception as exc:  # pragma: no cover
    print(f"Could not import Beds24Client: {exc}", file=sys.stderr)
    print("Run this from the project/cockpit environment where rental_intel is installed.", file=sys.stderr)
    raise SystemExit(2)


def safe_preview(value: Any, max_chars: int = 4000) -> Any:
    """Keep enough response detail to diagnose shape without huge output."""
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            lower = str(key).lower()
            if any(secret in lower for secret in ("token", "password", "secret", "authorization")):
                result[str(key)] = "<redacted>"
            elif isinstance(item, (dict, list)):
                result[str(key)] = safe_preview(item, max_chars=max_chars)
            else:
                text = str(item)
                result[str(key)] = text if len(text) <= max_chars else text[:max_chars] + "…"
        return result
    if isinstance(value, list):
        # A few rows are enough to identify the payload shape.
        return [safe_preview(item, max_chars=max_chars) for item in value[:3]]
    text = str(value)
    return text if len(text) <= max_chars else text[:max_chars] + "…"


def describe_payload(payload: Any) -> dict[str, Any]:
    description: dict[str, Any] = {"python_type": type(payload).__name__}
    if isinstance(payload, dict):
        description["top_level_keys"] = sorted(str(k) for k in payload.keys())
        for key in ("data", "reviews", "items", "results", "messages", "bookings"):
            value = payload.get(key)
            if isinstance(value, list):
                description[f"{key}_count_in_preview"] = len(value)
                if value and isinstance(value[0], dict):
                    description[f"{key}_first_row_keys"] = sorted(str(k) for k in value[0].keys())
            elif isinstance(value, dict):
                description[f"{key}_keys"] = sorted(str(k) for k in value.keys())
    elif isinstance(payload, list):
        description["list_count_in_preview"] = len(payload)
        if payload and isinstance(payload[0], dict):
            description["first_row_keys"] = sorted(str(k) for k in payload[0].keys())
    return description


def run_probe(client: Beds24Client, name: str, path: str, params: dict[str, Any] | None) -> dict[str, Any]:
    print(f"\n=== {name} ===")
    print(f"GET {path}")
    print(f"params={params or {}}")
    try:
        payload = client.get(path, params=params or None, max_retries=0)
        summary = describe_payload(payload)
        print("SUCCESS")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return {
            "name": name,
            "path": path,
            "params": params or {},
            "success": True,
            "summary": summary,
            "response_preview": safe_preview(payload),
        }
    except Exception as exc:
        print(f"FAILED: {exc}")
        return {
            "name": name,
            "path": path,
            "params": params or {},
            "success": False,
            "error": str(exc),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe Beds24 review-related API endpoints without changing core code.")
    parser.add_argument("--property-id", type=int, required=True, help="Beds24 property ID, e.g. 330389")
    parser.add_argument("--room-id", type=int, help="Optional Beds24 room/listing ID")
    parser.add_argument("--booking-id", help="Optional known Airbnb/Beds24 booking ID")
    parser.add_argument("--output", default="/tmp/beds24-review-probe.json", help="JSON report path")
    parser.add_argument(
        "--include-extra-endpoints",
        action="store_true",
        help="Also try a few alternate endpoint spellings (more API calls).",
    )
    args = parser.parse_args()

    load_dotenv()
    client = Beds24Client()

    probes: list[tuple[str, str, dict[str, Any] | None]] = [
        ("airbnb reviews, no parameters", "/channels/airbnb/reviews", None),
        ("airbnb reviews, propertyId only", "/channels/airbnb/reviews", {"propertyId": args.property_id}),
        ("airbnb reviews, propertyIds array style", "/channels/airbnb/reviews", {"propertyIds": [args.property_id]}),
        ("booking messages, propertyId only", "/bookings/messages", {"propertyId": args.property_id}),
        ("bookings, propertyId minimal", "/bookings", {"propertyId": args.property_id, "includeGuests": "true"}),
    ]

    if args.room_id is not None:
        probes.extend(
            [
                ("airbnb reviews, roomId only", "/channels/airbnb/reviews", {"roomId": args.room_id}),
                ("airbnb reviews, propertyId + roomId", "/channels/airbnb/reviews", {"propertyId": args.property_id, "roomId": args.room_id}),
                ("booking messages, roomId only", "/bookings/messages", {"roomId": args.room_id}),
            ]
        )

    if args.booking_id:
        probes.extend(
            [
                ("airbnb reviews, bookingId only", "/channels/airbnb/reviews", {"bookingId": args.booking_id}),
                ("booking messages, bookingId only", "/bookings/messages", {"bookingId": args.booking_id}),
            ]
        )

    if args.include_extra_endpoints:
        probes.extend(
            [
                ("alternate /reviews", "/reviews", {"propertyId": args.property_id}),
                ("alternate /channels/reviews", "/channels/reviews", {"propertyId": args.property_id}),
                ("alternate /airbnb/reviews", "/airbnb/reviews", {"propertyId": args.property_id}),
                ("alternate singular review", "/channels/airbnb/review", {"propertyId": args.property_id}),
            ]
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": getattr(client, "base_url", None),
        "property_id": args.property_id,
        "room_id": args.room_id,
        "booking_id": args.booking_id,
        "probes": [],
    }

    for name, path, params in probes:
        report["probes"].append(run_probe(client, name, path, params))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")

    successes = [probe for probe in report["probes"] if probe.get("success")]
    print("\n=== SUMMARY ===")
    print(f"Successful probes: {len(successes)}/{len(report['probes'])}")
    for probe in successes:
        print(f"- {probe['name']}: {probe['path']} params={probe['params']}")
    print(f"Full redacted report written to: {output}")
    print("Paste the console output and, ideally, the report contents back into ChatGPT.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
