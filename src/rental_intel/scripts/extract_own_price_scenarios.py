from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"
RAW = ROOT / "outputs" / "raw" / "market"


def load_csv(name: str) -> pd.DataFrame:
    path = PROCESSED / name
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def load_client_config(client_id: str) -> dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing client config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

def append_to_history(path: Path, df: pd.DataFrame) -> pd.DataFrame:
    if path.exists():
        existing = pd.read_csv(path)
        combined = pd.concat([existing, df], ignore_index=True)
    else:
        combined = df

    combined.to_csv(path, index=False)
    return combined


def build_listing_lookup(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}

    for portfolio in config.get("portfolios", []):
        portfolio_id = portfolio.get("portfolio_id")
        portfolio_name = portfolio.get("name")
        source = portfolio.get("source", {}) or {}
        portfolio_property_id = source.get("property_id") or portfolio.get("source_property_id")

        for listing in portfolio.get("listings", []):
            listing_id = str(listing.get("listing_id"))
            room_id = listing.get("source_room_id") or listing.get("room_id")
            property_id = (
                listing.get("source_property_id")
                or listing.get("property_id")
                or portfolio_property_id
            )

            if not listing_id or not room_id or not property_id:
                continue

            lookup[listing_id] = {
                "portfolio_id": portfolio_id,
                "portfolio_name": portfolio_name,
                "listing_id": listing_id,
                "listing_name": listing.get("name"),
                "property_id": int(property_id),
                "room_id": int(room_id),
            }

    return lookup


def as_list_response(response: Any) -> list[dict[str, Any]]:
    if response is None:
        return []

    if isinstance(response, list):
        return [x for x in response if isinstance(x, dict)]

    if isinstance(response, dict):
        data = response.get("data")
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]

        for key in [
            "roomPrices",
            "roomprices",
            "roomPrice",
            "offers",
            "rooms",
            "results",
        ]:
            value = response.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
            if isinstance(value, dict):
                return [value]

        if "roomprice" in response or "offerid" in response or "offerId" in response or "warn" in response:
            return [response]

    return []


def iter_offer_rows(response: Any) -> list[dict[str, Any]]:
    """
    Flatten Beds24 offer responses.

    Beds24 /inventory/rooms/offers returns rows like:
    {
      roomId,
      propertyId,
      offers: [
        {offerId, offerName, price, unitsAvailable}
      ]
    }

    Older/other endpoints may return direct roomprice rows.
    """
    rows = as_list_response(response)
    offers: list[dict[str, Any]] = []

    for row in rows:
        nested_offers = row.get("offers")

        if isinstance(nested_offers, list):
            for offer in nested_offers:
                if not isinstance(offer, dict):
                    continue

                merged = {
                    **row,
                    **offer,
                    "roomId": row.get("roomId"),
                    "propertyId": row.get("propertyId"),
                }
                merged.pop("offers", None)
                offers.append(merged)

        else:
            offers.append(row)

    return offers


def parse_offer_response(response: Any) -> dict[str, Any]:
    offers = iter_offer_rows(response)

    if not offers:
        return {
            "bookable": False,
            "offer_id": None,
            "offer_name": None,
            "offer_price": None,
            "units_available": 0,
            "warning": "No offer row returned",
            "raw_offer_count": 0,
        }

    priced = []

    for row in offers:
        price = (
            row.get("price")
            or row.get("roomprice")
            or row.get("total")
            or row.get("totalAmount")
        )

        try:
            numeric_price = float(price)
        except (TypeError, ValueError):
            numeric_price = None

        units_available = (
            row.get("unitsAvailable")
            or row.get("units_available")
            or row.get("available")
            or 0
        )

        try:
            units_available_int = int(float(units_available or 0))
        except (TypeError, ValueError):
            units_available_int = 0

        if numeric_price is not None and numeric_price > 0 and units_available_int > 0:
            priced.append((numeric_price, units_available_int, row))

    if priced:
        numeric_price, units_available_int, row = sorted(priced, key=lambda x: x[0])[0]

        return {
            "bookable": True,
            "offer_id": row.get("offerId") or row.get("offerid"),
            "offer_name": row.get("offerName") or row.get("offer_name") or "",
            "offer_price": round(numeric_price, 2),
            "units_available": units_available_int,
            "warning": row.get("warn") or row.get("warning") or "",
            "raw_offer_count": len(offers),
        }

    warnings = [
        str(row.get("warn") or row.get("warning") or "").strip()
        for row in offers
        if str(row.get("warn") or row.get("warning") or "").strip()
    ]

    # Helpful diagnostic: Beds24 returned room rows but no offers array.
    room_rows_without_offers = [
        row for row in as_list_response(response)
        if "roomId" in row and not row.get("offers")
    ]

    if room_rows_without_offers:
        warning = "No offers returned for room/date; likely unavailable, blocked, or restriction prevents quote"
    else:
        warning = " | ".join(warnings) if warnings else "No positive priced offer"

    return {
        "bookable": False,
        "offer_id": offers[0].get("offerId") or offers[0].get("offerid"),
        "offer_name": offers[0].get("offerName") or offers[0].get("offer_name") or "",
        "offer_price": None,
        "units_available": 0,
        "warning": warning,
        "raw_offer_count": len(offers),
    }

def main() -> None:
    load_dotenv(ROOT / ".env", override=True)

    client_id = "daniel_aurore"
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d_%H%M%S")

    jobs = load_csv("market_probe_jobs.csv")
    if jobs.empty:
        raise FileNotFoundError(
            "market_probe_jobs.csv missing or empty. Run build_market_jobs first."
        )

    own_jobs = jobs[jobs["job_type"].astype(str) == "own_beds24"].copy()

    if own_jobs.empty:
        print("No own Beds24 jobs found.")
        return

    config = load_client_config(client_id)
    listing_lookup = build_listing_lookup(config)

    beds24 = Beds24Client()

    RAW.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []

    for i, job in own_jobs.iterrows():
        listing_id = str(job["listing_id"])
        meta = listing_lookup.get(listing_id)

        if not meta:
            rows.append(
                {
                    "run_id": run_id,
                    "retrieved_at": now.isoformat(),
                    "status": "failed_no_mapping",
                    "error": f"No Beds24 mapping for listing_id={listing_id}",
                    **job.to_dict(),
                    "source_property_id": None,
                    "source_room_id": None,
                    "bookable": False,
                    "offer_id": None,
                    "offer_name": None,
                    "own_total_amount": None,
                    "own_nightly_amount": None,
                    "units_available": 0,
                    "warning": "No Beds24 mapping",
                    "raw_offer_count": 0,
                }
            )
            continue

        arrival = str(job["check_in"])
        departure = str(job["check_out"])
        nights = int(job["nights"])
        adults = int(job.get("adults") or 2)
        children = int(job.get("children") or 0)

        print(
            f"[{len(rows)+1}/{len(own_jobs)}] {listing_id} "
            f"{arrival} → {departure} ({nights} nights)"
        )

        try:
            response = beds24.get_offers(
                property_id=meta["property_id"],
                room_id=meta["room_id"],
                arrival=arrival,
                departure=departure,
                num_adults=adults,
                num_children=children,
            )

            parsed = parse_offer_response(response)

            own_total = parsed["offer_price"]
            own_nightly = (
                round(float(own_total) / nights, 2)
                if own_total is not None and nights
                else None
            )

            status = "success_available" if parsed["bookable"] else "success_unavailable"

            row = {
                "run_id": run_id,
                "retrieved_at": now.isoformat(),
                "status": status,
                "error": "",
                **job.to_dict(),
                "source_property_id": meta["property_id"],
                "source_room_id": meta["room_id"],
                "bookable": parsed["bookable"],
                "offer_id": parsed["offer_id"],
                "offer_name": parsed["offer_name"],
                "own_total_amount": own_total,
                "own_nightly_amount": own_nightly,
                "units_available": parsed["units_available"],
                "warning": parsed["warning"],
                "raw_offer_count": parsed["raw_offer_count"],
            }

            rows.append(row)

            raw_records.append(
                {
                    "job": job.to_dict(),
                    "mapping": meta,
                    "response": response,
                    "parsed": parsed,
                }
            )

        except Exception as exc:
            rows.append(
                {
                    "run_id": run_id,
                    "retrieved_at": now.isoformat(),
                    "status": "failed_api",
                    "error": repr(exc),
                    **job.to_dict(),
                    "source_property_id": meta["property_id"],
                    "source_room_id": meta["room_id"],
                    "bookable": False,
                    "offer_id": None,
                    "offer_name": None,
                    "own_total_amount": None,
                    "own_nightly_amount": None,
                    "units_available": 0,
                    "warning": "",
                    "raw_offer_count": 0,
                }
            )

    out = pd.DataFrame(rows)

    latest_path = PROCESSED / "own_price_scenarios.csv"
    history_path = PROCESSED / "own_price_scenarios_history.csv"

    out.to_csv(latest_path, index=False)
    append_to_history(history_path, out)

    raw_path = RAW / f"own_price_scenarios_raw_{run_id}.json"
    raw_path.write_text(
        json.dumps(raw_records, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    print()
    print(f"Wrote latest own price scenarios to {latest_path}")
    print(f"Appended own price scenario history to {history_path}")
    print(f"Wrote raw own price responses to {raw_path}")
    print()
    print("Status counts:")
    print(out.groupby("status").size().to_string())

    preview_cols = [
        "listing_id",
        "scenario_id",
        "check_in",
        "check_out",
        "nights",
        "status",
        "bookable",
        "own_total_amount",
        "own_nightly_amount",
        "units_available",
        "warning",
    ]

    print()
    print(out[preview_cols].to_string(index=False))


if __name__ == "__main__":
    main()
