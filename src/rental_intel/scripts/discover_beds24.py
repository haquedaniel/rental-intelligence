from __future__ import annotations

import json
from pathlib import Path

import yaml
from dotenv import load_dotenv

from rental_intel.ingest.beds24 import Beds24Client


ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    load_dotenv(override=True)

    client = Beds24Client()
    response = client.get_properties(include_all_rooms=True)

    raw_path = ROOT / "outputs" / "raw" / "beds24_properties.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(response, indent=2, ensure_ascii=False), encoding="utf-8")

    discovered = {
        "source_system": "beds24",
        "properties": [],
    }

    for prop in response.get("data", []):
        discovered_prop = {
            "property_id": prop.get("id"),
            "name": prop.get("name"),
            "property_type": prop.get("propertyType"),
            "currency": prop.get("currency"),
            "city": prop.get("city"),
            "country": prop.get("country"),
            "postcode": prop.get("postcode"),
            "check_in_start": prop.get("checkInStart"),
            "check_out_end": prop.get("checkOutEnd"),
            "rooms": [],
        }

        for room in prop.get("roomTypes", []):
            discovered_prop["rooms"].append(
                {
                    "room_id": room.get("id"),
                    "property_id": room.get("propertyId"),
                    "name": room.get("name"),
                    "room_type": room.get("roomType"),
                    "qty": room.get("qty"),
                    "max_people": room.get("maxPeople"),
                    "min_stay": room.get("minStay"),
                    "max_stay": room.get("maxStay"),
                    "rack_rate": room.get("rackRate"),
                    "cleaning_fee": room.get("cleaningFee"),
                    "security_deposit": room.get("securityDeposit"),
                    "include_in_reports": room.get("includeInReports"),
                }
            )

        discovered["properties"].append(discovered_prop)

    out_path = ROOT / "config" / "discovered" / "beds24.yaml"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        yaml.safe_dump(discovered, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    print(f"Wrote raw Beds24 properties to {raw_path}")
    print(f"Wrote discovered config to {out_path}")
    print()
    for prop in discovered["properties"]:
        print(f"{prop['property_id']} - {prop['name']}")
        for room in prop["rooms"]:
            print(f"  {room['room_id']} - {room['name']}")


if __name__ == "__main__":
    main()
