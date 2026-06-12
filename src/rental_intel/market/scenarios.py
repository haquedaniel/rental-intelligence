from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Any


def clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "yes", "y", "1", "oui", "active"}


def to_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(value))

def saturday_on_or_before(d: date) -> date:
    return d - timedelta(days=(d.weekday() - 5) % 7)

def weekday_from_string(value: Any) -> int:
    text = clean_string(value).lower()
    mapping = {
        "monday": 0, "mon": 0, "lundi": 0,
        "tuesday": 1, "tue": 1, "mardi": 1,
        "wednesday": 2, "wed": 2, "mercredi": 2,
        "thursday": 3, "thu": 3, "jeudi": 3,
        "friday": 4, "fri": 4, "vendredi": 4,
        "saturday": 5, "sat": 5, "samedi": 5,
        "sunday": 6, "sun": 6, "dimanche": 6,
    }
    return mapping.get(text, 5)


def next_weekday(start: date, weekday: int) -> date:
    days_ahead = (weekday - start.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return start + timedelta(days=days_ahead)


def first_weekday_of_month(year: int, month: int, weekday: int) -> date:
    d = date(year, month, 1)
    days_ahead = (weekday - d.weekday()) % 7
    return d + timedelta(days=days_ahead)


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def generate_windows_for_scenario(scenario: dict[str, Any], today: date) -> list[dict[str, Any]]:
    scenario_id = clean_string(scenario.get("scenario_id"))
    mode = clean_string(scenario.get("mode") or "weekly").lower()

    nights = to_int(scenario.get("nights"), 7)
    adults = to_int(scenario.get("adults"), 2)
    children = to_int(scenario.get("children"), 0)
    infants = to_int(scenario.get("infants"), 0)
    pets = to_int(scenario.get("pets"), 0)
    checkin_weekday = weekday_from_string(scenario.get("checkin_weekday", "saturday"))

    horizon_count = to_int(
        scenario.get("horizon_count"),
        4 if mode == "weekly" else 6,
    )
    month_start_offset = to_int(
        scenario.get("month_start_offset"),
        0 if mode == "weekly" else 1,
    )

    windows: list[dict[str, Any]] = []

    if mode == "weekly":
        first = next_weekday(today, checkin_weekday)
        for i in range(horizon_count):
            check_in = first + timedelta(weeks=i)
            check_out = check_in + timedelta(days=nights)
            windows.append(
                {
                    "scenario_id": scenario_id,
                    "mode": mode,
                    "window_index": i + 1,
                    "check_in": check_in,
                    "check_out": check_out,
                    "nights": nights,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "pets": pets,
                }
            )
        return windows

    if mode == "monthly":
        month_anchor = date(today.year, today.month, 1)
        for i in range(horizon_count):
            target_month = add_months(month_anchor, month_start_offset + i)
            check_in = first_weekday_of_month(
                target_month.year,
                target_month.month,
                checkin_weekday,
            )
            check_out = check_in + timedelta(days=nights)
            windows.append(
                {
                    "scenario_id": scenario_id,
                    "mode": mode,
                    "window_index": i + 1,
                    "check_in": check_in,
                    "check_out": check_out,
                    "nights": nights,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "pets": pets,
                }
            )
        return windows
    
    if mode == "explicit":
        check_in = date.fromisoformat(clean_string(scenario.get("check_in")))
        check_out = date.fromisoformat(clean_string(scenario.get("check_out")))
        nights = (check_out - check_in).days

        windows.append(
            {
                "scenario_id": scenario_id,
                "mode": mode,
                "window_index": 1,
                "check_in": check_in,
                "check_out": check_out,
                "nights": nights,
                "adults": adults,
                "children": children,
                "infants": infants,
                "pets": pets,
            }
        )
        return windows
    
    if mode == "relative_offsets":
        offsets = scenario.get("offset_days", []) or []

        for i, offset in enumerate(offsets):
            check_in = today + timedelta(days=int(offset))
            check_out = check_in + timedelta(days=nights)

            windows.append(
                {
                    "scenario_id": scenario_id,
                    "mode": mode,
                    "window_index": i + 1,
                    "check_in": check_in,
                    "check_out": check_out,
                    "nights": nights,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "pets": pets,
                }
            )

        return windows

    if mode == "anchor_dates":
        anchor_dates = scenario.get("anchor_dates", []) or []

        for i, anchor in enumerate(anchor_dates):
            anchor_date = date.fromisoformat(clean_string(anchor))
            check_in = saturday_on_or_before(anchor_date)
            check_out = check_in + timedelta(days=nights)

            windows.append(
                {
                    "scenario_id": scenario_id,
                    "mode": mode,
                    "window_index": i + 1,
                    "check_in": check_in,
                    "check_out": check_out,
                    "nights": nights,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "pets": pets,
                }
            )

        return windows

    raise ValueError(f"Unsupported scenario mode: {mode}")
