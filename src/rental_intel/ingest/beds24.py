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
        arrival_from: Optional[str] = None,
        arrival_to: Optional[str] = None,
        departure_from: Optional[str] = None,
        departure_to: Optional[str] = None,
        booking_time_from: Optional[str] = None,
        booking_time_to: Optional[str] = None,
        modified_from: Optional[str] = None,
        modified_to: Optional[str] = None,
        statuses: Optional[list[str]] = None,
        include_invoice_items: bool = True,
        include_guests: bool = True,
        page: Optional[int] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "includeInvoiceItems": str(include_invoice_items).lower(),
            "includeGuests": str(include_guests).lower(),
        }

        if property_id is not None:
            params["propertyId"] = property_id

        if room_id is not None:
            params["roomId"] = room_id

        if arrival_from:
            params["arrivalFrom"] = arrival_from

        if arrival_to:
            params["arrivalTo"] = arrival_to

        if departure_from:
            params["departureFrom"] = departure_from

        if departure_to:
            params["departureTo"] = departure_to

        if booking_time_from:
            params["bookingTimeFrom"] = booking_time_from

        if booking_time_to:
            params["bookingTimeTo"] = booking_time_to

        if modified_from:
            params["modifiedFrom"] = modified_from

        if modified_to:
            params["modifiedTo"] = modified_to

        if statuses:
            params["status"] = statuses

        if page is not None:
            params["page"] = page

        return self.get("/bookings", params=params)
    
    def get_offers(
        self,
        property_id: Optional[int] = None,
        room_id: Optional[int] = None,
        arrival: Optional[str] = None,
        departure: Optional[str] = None,
        num_adults: int = 2,
        num_children: int = 0,
    ) -> Dict[str, Any]:
        if not arrival or not departure:
            raise ValueError("arrival and departure are required")

        params: Dict[str, Any] = {
            "arrival": arrival,
            "departure": departure,
            "numAdults": num_adults,
            "numChildren": num_children,
        }

        if property_id is not None:
            params["propertyId"] = property_id

        if room_id is not None:
            params["roomId"] = room_id

        return self.get("/inventory/rooms/offers", params=params)