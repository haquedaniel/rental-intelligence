from __future__ import annotations

import json
import time
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]


PRICE_SCENARIOS = [
    {"scenario": "2n_2a", "nights": 2, "num_adults": 2, "num_children": 0},
    {"scenario": "3n_2a", "nights": 3, "num_adults": 2, "num_children": 0},
    {"scenario": "7n_2a", "nights": 7, "num_adults": 2, "num_children": 0},
]

MIN_STAY_TEST_NIGHTS = [1, 2, 3, 4, 5, 6, 7]


def load_client_config(client_id: str) -> Dict[str, Any]:
    path = ROOT / "config" / "clients" / f"{client_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing client config: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def build_room_mapping(config: Dict[str, Any]) -> Dict[int, Dict[str, str]]:
    mapping: Dict[int, Dict[str, str]] = {}

    for portfolio in config.get("portfolios", []):
        for listing in portfolio.get("listings", []):
            room_id = int(listing["source_room_id"])
            mapping[room_id] = {
                "portfolio_id": portfolio["portfolio_id"],
                "portfolio_name": portfolio["name"],
                "listing_id": listing["listing_id"],
                "listing_name": listing["name"],
            }

    return mapping


def parse_offer_response(
    response: Dict[str, Any],
    client_id: str,
    property_id: int,
    arrival: date,
    departure: date,
    scenario: str,
    nights: int,
    num_adults: int,
    num_children: int,
    room_mapping: Dict[int, Dict[str, str]],
    retrieved_at: str,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for room_result in response.get("data", []):
        room_id = int(room_result["roomId"])
        mapped = room_mapping.get(room_id, {})
        offers = room_result.get("offers") or []

        if not offers:
            rows.append(
                {
                    "client_id": client_id,
                    "portfolio_id": mapped.get("portfolio_id"),
                    "portfolio_name": mapped.get("portfolio_name"),
                    "listing_id": mapped.get("listing_id"),
                    "listing_name": mapped.get("listing_name"),
                    "source_property_id": property_id,
                    "source_room_id": room_id,
                    "arrival": arrival.isoformat(),
                    "departure": departure.isoformat(),
                    "nights": nights,
                    "scenario": scenario,
                    "num_adults": num_adults,
                    "num_children": num_children,
                    "bookable": False,
                    "offer_id": None,
                    "offer_name": None,
                    "offer_price": None,
                    "units_available": 0,
                    "effective_price_per_night": None,
                    "retrieved_at": retrieved_at,
                }
            )
            continue

        best_offer = min(offers, key=lambda o: float(o.get("price") or 0))
        offer_price = float(best_offer.get("price") or 0)
        units_available = int(best_offer.get("unitsAvailable") or 0)

        rows.append(
            {
                "client_id": client_id,
                "portfolio_id": mapped.get("portfolio_id"),
                "portfolio_name": mapped.get("portfolio_name"),
                "listing_id": mapped.get("listing_id"),
                "listing_name": mapped.get("listing_name"),
                "source_property_id": property_id,
                "source_room_id": room_id,
                "arrival": arrival.isoformat(),
                "departure": departure.isoformat(),
                "nights": nights,
                "scenario": scenario,
                "num_adults": num_adults,
                "num_children": num_children,
                "bookable": units_available > 0,
                "offer_id": best_offer.get("offerId"),
                "offer_name": best_offer.get("offerName"),
                "offer_price": offer_price,
                "units_available": units_available,
                "effective_price_per_night": round(offer_price / nights, 2) if nights else None,
                "retrieved_at": retrieved_at,
            }
        )

    return rows


def derive_effective_min_stay(offers: pd.DataFrame) -> pd.DataFrame:
    """
    Derive effective minimum stay per listing / arrival date by finding
    the shortest tested stay length that returned a bookable offer.
    """
    if offers.empty:
        return pd.DataFrame()

    min_rows = offers[offers["scenario"].str.startswith("minstay_")].copy()

    if min_rows.empty:
        return pd.DataFrame()

    bookable = min_rows[min_rows["bookable"] == True].copy()

    group_cols = [
        "client_id",
        "portfolio_id",
        "portfolio_name",
        "listing_id",
        "listing_name",
        "source_property_id",
        "source_room_id",
        "arrival",
    ]

    if bookable.empty:
        no_bookable = (
            min_rows[group_cols]
            .drop_duplicates()
            .assign(
                shortest_bookable_stay_tested=None,
                min_stay_status="no_tested_stay_bookable",
            )
        )
        return no_bookable

    first_bookable = (
        bookable.sort_values("nights")
        .groupby(group_cols, dropna=False)
        .first()
        .reset_index()
    )

    first_bookable = first_bookable.rename(
        columns={
            "nights": "shortest_bookable_stay_tested",
            "offer_price": "shortest_bookable_offer_price",
            "effective_price_per_night": "shortest_bookable_price_per_night",
        }
    )

    first_bookable["min_stay_status"] = "observed_from_offers"

    return first_bookable[
        group_cols
        + [
            "shortest_bookable_stay_tested",
            "shortest_bookable_offer_price",
            "shortest_bookable_price_per_night",
            "min_stay_status",
            "retrieved_at",
        ]
    ]


def main() -> None:
    load_dotenv(override=True)

    client_id = "daniel_aurore"
    horizon_days = 60
    sleep_seconds = 0.35

    config = load_client_config(client_id)
    room_mapping = build_room_mapping(config)
    beds24 = Beds24Client()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    start = date.today()

    all_rows: List[Dict[str, Any]] = []
    raw_responses: List[Dict[str, Any]] = []

    for portfolio in config.get("portfolios", []):
        source = portfolio.get("source", {})
        if source.get("system") != "beds24":
            continue

        property_id = int(source["property_id"])

        print(f"Scanning property {property_id} / {portfolio['name']}")

        for day_offset in range(horizon_days):
            arrival = start + timedelta(days=day_offset)

            scenarios = []

            for n in MIN_STAY_TEST_NIGHTS:
                scenarios.append(
                    {
                        "scenario": f"minstay_{n}n",
                        "nights": n,
                        "num_adults": 2,
                        "num_children": 0,
                    }
                )

            scenarios.extend(PRICE_SCENARIOS)

            # Avoid duplicate calls where a price scenario is also a min-stay test.
            unique_scenarios = {
                (s["nights"], s["num_adults"], s["num_children"], s["scenario"]): s
                for s in scenarios
            }.values()

            for scenario in unique_scenarios:
                nights = int(scenario["nights"])
                departure = arrival + timedelta(days=nights)

                try:
                    response = beds24.get_offers(
                        property_id=property_id,
                        arrival=arrival.isoformat(),
                        departure=departure.isoformat(),
                        num_adults=int(scenario["num_adults"]),
                        num_children=int(scenario["num_children"]),
                    )
                except Exception as exc:
                    print(
                        f"WARNING: offers failed for property={property_id}, "
                        f"arrival={arrival}, nights={nights}: {exc}"
                    )
                    continue

                raw_responses.append(
                    {
                        "property_id": property_id,
                        "arrival": arrival.isoformat(),
                        "departure": departure.isoformat(),
                        "scenario": scenario,
                        "response": response,
                    }
                )

                all_rows.extend(
                    parse_offer_response(
                        response=response,
                        client_id=client_id,
                        property_id=property_id,
                        arrival=arrival,
                        departure=departure,
                        scenario=str(scenario["scenario"]),
                        nights=nights,
                        num_adults=int(scenario["num_adults"]),
                        num_children=int(scenario["num_children"]),
                        room_mapping=room_mapping,
                        retrieved_at=retrieved_at,
                    )
                )

                time.sleep(sleep_seconds)

    raw_path = ROOT / "outputs" / "raw" / "future_offers_raw.json"
    raw_path.write_text(json.dumps(raw_responses, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote raw offers to {raw_path}")

    offers = pd.DataFrame(all_rows)
    offers_path = ROOT / "outputs" / "processed" / "future_offers.csv"
    offers.to_csv(offers_path, index=False)
    print(f"Wrote future offers to {offers_path}")

    min_stay = derive_effective_min_stay(offers)
    min_stay_path = ROOT / "outputs" / "processed" / "effective_min_stay.csv"
    min_stay.to_csv(min_stay_path, index=False)
    print(f"Wrote effective min stay to {min_stay_path}")

    if not offers.empty:
        print()
        print("Future offer summary:")
        print(
            offers.groupby(["portfolio_id", "listing_id", "scenario"], dropna=False)
            .agg(
                quote_count=("arrival", "count"),
                bookable_count=("bookable", "sum"),
                min_price_per_night=("effective_price_per_night", "min"),
                avg_price_per_night=("effective_price_per_night", "mean"),
                max_price_per_night=("effective_price_per_night", "max"),
            )
            .round(2)
            .to_string()
        )

    if not min_stay.empty:
        print()
        print("Effective min-stay summary:")
        print(
            min_stay.groupby(["portfolio_id", "listing_id", "shortest_bookable_stay_tested"], dropna=False)
            .size()
            .to_string()
        )


if __name__ == "__main__":
    main()
