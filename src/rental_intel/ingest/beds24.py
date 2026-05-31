from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests


BASE_URL = "https://beds24.com/api/v2"


class Beds24Client:
    def __init__(self, token: Optional[str] = None) -> None:
        self.token = token or os.getenv("BEDS24_TOKEN")
        if not self.token:
            raise ValueError("Missing BEDS24_TOKEN. Export it or put it in .env.")

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{BASE_URL}{path}"
        response = requests.get(
            url,
            headers={
                "accept": "application/json",
                "token": self.token,
            },
            params=params or {},
            timeout=30,
        )

        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError(f"Beds24 returned non-JSON response: {response.text[:500]}") from exc

        if response.status_code >= 400 or data.get("success") is False:
            raise RuntimeError(f"Beds24 API error {response.status_code}: {data}")

        return data

    def get_properties(self, include_all_rooms: bool = True) -> Dict[str, Any]:
        return self.get(
            "/properties",
            params={"includeAllRooms": str(include_all_rooms).lower()},
        )

    def get_bookings(
        self,
        property_id: Optional[int] = None,
        room_id: Optional[int] = None,
        include_invoice_items: bool = True,
        include_guests: bool = True,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "includeInvoiceItems": str(include_invoice_items).lower(),
            "includeGuests": str(include_guests).lower(),
        }

        if property_id is not None:
            params["propertyId"] = property_id

        if room_id is not None:
            params["roomId"] = room_id

        return self.get("/bookings", params=params)
