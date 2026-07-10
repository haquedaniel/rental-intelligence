from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional

import requests


class Beds24Client:
    def __init__(self) -> None:
        self.base_url = "https://beds24.com/api/v2"

        self.token = os.getenv("BEDS24_TOKEN")
        self.refresh_token = os.getenv("BEDS24_REFRESH_TOKEN")

        if not self.token and not self.refresh_token:
            raise RuntimeError(
                "Missing Beds24 credentials. Set BEDS24_TOKEN or BEDS24_REFRESH_TOKEN."
            )

        if not self.token and self.refresh_token:
            self.refresh_access_token()

        self.headers = self._headers()

    def _headers(self) -> Dict[str, str]:
        if not self.token:
            raise RuntimeError("Missing Beds24 access token")
        return {
            "accept": "application/json",
            "token": self.token,
        }

    def refresh_access_token(self) -> None:
        if not self.refresh_token:
            raise RuntimeError(
                "BEDS24 token expired and no BEDS24_REFRESH_TOKEN is available."
            )

        response = requests.get(
            f"{self.base_url}/authentication/token",
            headers={
                "accept": "application/json",
                "refreshToken": self.refresh_token,
            },
        )

        try:
            data = response.json()
        except ValueError:
            raise RuntimeError(
                f"Could not parse Beds24 token refresh response: {response.text}"
            )

        if response.status_code >= 400 or "token" not in data:
            raise RuntimeError(
                f"Beds24 token refresh failed {response.status_code}: {data}"
            )

        self.token = data["token"]
        self.headers = self._headers()

        print("Refreshed Beds24 access token.")

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"

        token_refreshed = False

        for attempt in range(max_retries + 1):
            response = requests.get(url, headers=self.headers, params=params)

            try:
                data = response.json()
            except ValueError:
                data = response.text

            if response.status_code == 401 and not token_refreshed:
                print("Beds24 token invalid. Refreshing token and retrying...")
                self.refresh_access_token()
                token_refreshed = True
                continue

            if response.status_code == 429:
                reset_seconds = response.headers.get("X-FiveMinCreditLimit-ResetsIn")
                wait_seconds = int(reset_seconds) + 5 if reset_seconds else 305

                if attempt < max_retries:
                    print(
                        f"Beds24 credit limit hit. Waiting {wait_seconds}s before retry..."
                    )
                    time.sleep(wait_seconds)
                    continue

            if response.status_code >= 400:
                raise RuntimeError(f"Beds24 API error {response.status_code}: {data}")

            if isinstance(data, dict) and data.get("success") is False:
                # Some Beds24 errors may be HTTP 200 with success=false.
                if data.get("code") == 401 and not token_refreshed:
                    print("Beds24 token invalid. Refreshing token and retrying...")
                    self.refresh_access_token()
                    token_refreshed = True
                    continue

                raise RuntimeError(f"Beds24 API returned error: {data}")

            return data

        raise RuntimeError("Beds24 API request failed after retries.")

    def get_properties(
        self,
        include_all_rooms: bool = True,
        include_price_rules: bool = False,
        include_offers: bool = False,
    ) -> Dict[str, Any]:
        params = {
            "includeAllRooms": str(include_all_rooms).lower(),
        }

        if include_price_rules:
            params["includePriceRules"] = "true"

        if include_offers:
            params["includeOffers"] = "true"

        return self.get("/properties", params=params)

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

    def get_room_availability(
        self,
        room_id: int,
        from_date: str,
        to_date: str,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "roomId": room_id,
            "from": from_date,
            "to": to_date,
        }

        return self.get("/inventory/rooms/availability", params=params)

    def get_booking_messages(
        self,
        booking_id: Optional[int | str] = None,
        property_id: Optional[int] = None,
        room_id: Optional[int] = None,
        modified_from: Optional[str] = None,
        modified_to: Optional[str] = None,
        page: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Fetch Beds24/OTA guest messages.

        Beds24 API v2 documents this under /bookings/messages.
        We keep the method deliberately thin and store the raw response in our
        own ingestion output first, because exact message field names vary by
        channel and Beds24 account settings.
        """
        params: Dict[str, Any] = {}

        if booking_id is not None:
            params["bookingId"] = booking_id

        if property_id is not None:
            params["propertyId"] = property_id

        if room_id is not None:
            params["roomId"] = room_id

        if modified_from:
            params["modifiedFrom"] = modified_from

        if modified_to:
            params["modifiedTo"] = modified_to

        if page is not None:
            params["page"] = page

        return self.get("/bookings/messages", params=params)
    
    def post(
        self,
        path: str,
        json_data: Any,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"

        token_refreshed = False

        for attempt in range(max_retries + 1):
            response = requests.post(
                url,
                headers=self.headers,
                params=params,
                json=json_data,
            )

            try:
                data = response.json()
            except ValueError:
                data = response.text

            if response.status_code == 401 and not token_refreshed:
                print("Beds24 token invalid. Refreshing token and retrying...")
                self.refresh_access_token()
                token_refreshed = True
                continue

            if response.status_code == 429:
                reset_seconds = response.headers.get("X-FiveMinCreditLimit-ResetsIn")
                wait_seconds = int(reset_seconds) + 5 if reset_seconds else 305

                if attempt < max_retries:
                    print(
                        f"Beds24 credit limit hit. Waiting {wait_seconds}s before retry..."
                    )
                    time.sleep(wait_seconds)
                    continue

            if response.status_code >= 400:
                raise RuntimeError(f"Beds24 API error {response.status_code}: {data}")

            if isinstance(data, dict) and data.get("success") is False:
                raise RuntimeError(f"Beds24 API returned error: {data}")

            return data

        raise RuntimeError("Beds24 API POST request failed after retries.")

    def create_booking(self, booking_payload: Dict[str, Any]) -> Dict[str, Any]:
        # Beds24 v2 POST endpoints generally accept an array payload.
        return self.post("/bookings", json_data=[booking_payload])
