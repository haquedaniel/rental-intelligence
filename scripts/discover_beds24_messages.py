from __future__ import annotations

import argparse
import json
from collections import Counter
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


def list_from_response(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, dict):
        data = response.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            for key in ("messages", "items", "bookingMessages"):
                nested = data.get(key)
                if isinstance(nested, list):
                    return [item for item in nested if isinstance(item, dict)]
        for key in ("messages", "items", "bookingMessages"):
            value = response.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    return []


def next_page_exists(response: Any) -> bool:
    if not isinstance(response, dict):
        return False
    pages = response.get("pages")
    return isinstance(pages, dict) and bool(pages.get("nextPageExists"))


def fetch_pages(
    client: Beds24Client,
    *,
    booking_id: str | None = None,
    property_id: int | None = None,
    page: int | None = None,
    max_pages: int = 1,
) -> list[dict[str, Any]]:
    responses: list[dict[str, Any]] = []
    current_page = page or 1

    while len(responses) < max_pages:
        response = client.get_booking_messages(
            booking_id=booking_id,
            property_id=property_id,
            page=current_page,
        )
        responses.append(response)

        if not next_page_exists(response):
            break
        current_page += 1

    return responses


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch raw Beds24 booking messages for inspection.")
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--booking-id", help="Beds24 numeric booking id, if known. OTA refs may not filter.")
    parser.add_argument("--property-id", type=int, help="Fetch messages by Beds24 property id")
    parser.add_argument("--limit", type=int, default=10, help="Max bookings to test when reading CSV")
    parser.add_argument("--page", type=int)
    parser.add_argument("--max-pages", type=int, default=1)
    args = parser.parse_args()

    load_dotenv()
    client = Beds24Client()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if args.booking_id or args.property_id:
        responses = fetch_pages(
            client,
            booking_id=args.booking_id,
            property_id=args.property_id,
            page=args.page,
            max_pages=args.max_pages,
        )
        label = (
            f"booking_{args.booking_id}"
            if args.booking_id
            else f"property_{args.property_id}"
        )
        out = RAW_DIR / f"beds24_messages_{label}.json"
        if len(responses) == 1:
            payload: Any = responses[0]
        else:
            payload = {"success": True, "pages_fetched": len(responses), "responses": responses}
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        messages = [message for response in responses for message in list_from_response(response)]
        counts = Counter(str(message.get("bookingId")) for message in messages if message.get("bookingId"))
        print(f"Wrote {out}")
        print(f"Messages: {len(messages)}")
        print(f"Distinct Beds24 bookingIds: {len(counts)}")
        for booking_id, count in counts.most_common(20):
            print(f"  {booking_id}: {count}")
        return

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)
    df = pd.read_csv(csv_path)
    booking_ids = [
        clean(value)
        for value in df.get("source_booking_id", pd.Series(dtype=str)).tolist()
        if clean(value)
    ][: args.limit]

    for booking_id in booking_ids:
        try:
            responses = fetch_pages(client, booking_id=booking_id, page=args.page, max_pages=args.max_pages)
        except Exception as exc:
            print(f"{booking_id}: ERROR {exc}")
            continue

        out = RAW_DIR / f"beds24_messages_booking_{booking_id}.json"
        payload = responses[0] if len(responses) == 1 else {"success": True, "pages_fetched": len(responses), "responses": responses}
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        messages = [message for response in responses for message in list_from_response(response)]
        counts = Counter(str(message.get("bookingId")) for message in messages if message.get("bookingId"))
        print(f"{booking_id}: wrote {out}")
        print(f"  messages: {len(messages)}")
        print(f"  distinct bookingIds in response: {len(counts)}")
        if counts and (len(counts) > 1 or str(booking_id) not in counts):
            print("  WARNING: response is not filtered to requested booking id; use message.bookingId for sync.")


if __name__ == "__main__":
    main()
