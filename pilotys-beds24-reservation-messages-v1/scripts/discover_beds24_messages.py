from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


DEFAULT_CSV = Path("outputs/processed/normalized_reservations.csv")
RAW_DIR = Path("outputs/raw")


def clean(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    text = str(value).strip()
    return text or None


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch raw Beds24 booking messages for inspection.")
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--booking-id", help="Fetch one booking id only")
    parser.add_argument("--property-id", type=int, help="Fetch messages by Beds24 property id")
    parser.add_argument("--limit", type=int, default=10, help="Max bookings to test when reading CSV")
    parser.add_argument("--page", type=int)
    args = parser.parse_args()

    load_dotenv()
    client = Beds24Client()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if args.booking_id:
      booking_ids = [args.booking_id]
    elif args.property_id:
      booking_ids = []
    else:
      csv_path = Path(args.csv)
      if not csv_path.exists():
          raise FileNotFoundError(csv_path)
      df = pd.read_csv(csv_path)
      booking_ids = [
          clean(value)
          for value in df.get("source_booking_id", pd.Series(dtype=str)).tolist()
          if clean(value)
      ][: args.limit]

    if args.property_id:
        response = client.get_booking_messages(property_id=args.property_id, page=args.page)
        out = RAW_DIR / f"beds24_messages_property_{args.property_id}.json"
        out.write_text(json.dumps(response, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {out}")
        print(json.dumps(response, indent=2, ensure_ascii=False)[:4000])
        return

    for booking_id in booking_ids:
        try:
            response = client.get_booking_messages(booking_id=booking_id, page=args.page)
        except Exception as exc:
            print(f"{booking_id}: ERROR {exc}")
            continue

        out = RAW_DIR / f"beds24_messages_booking_{booking_id}.json"
        out.write_text(json.dumps(response, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{booking_id}: wrote {out}")

        data = response.get("data") if isinstance(response, dict) else None
        if isinstance(data, list):
            print(f"  messages: {len(data)}")
        else:
            print("  response keys:", list(response.keys()) if isinstance(response, dict) else type(response))


if __name__ == "__main__":
    main()
