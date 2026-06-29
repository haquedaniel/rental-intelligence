from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone

from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

load_dotenv()

BONUS_PERCENT = float(os.getenv("CLEANING_NO_CHOICE_BONUS_PERCENT", "10"))
APPLY = os.getenv("APPLY", "false").lower() in {"1", "true", "yes", "y"}

UPDATE_STATUSES = {
    "created",
    "sent",
    "accepted",
}

FINAL_STATUSES = {
    "cancelled",
    "refused",
    "completed",
    "report_submitted",
    "problem_reported",
}


def money(value: float | int | str | None) -> float:
    return round(float(value or 0), 2)


def load_all(supabase, table: str, select: str = "*") -> list[dict]:
    result = supabase.table(table).select(select).execute()
    return result.data or []


def main() -> None:
    supabase = get_supabase_client()

    requests = load_all(
        supabase,
        "cleaning_requests",
        "id,status,property_id,reservation_id,cleaning_cost_eur,travel_cost_eur,urgency_bonus_percent,urgency_bonus_eur,total_cost_eur,urgent",
    )

    options = load_all(
        supabase,
        "cleaning_request_ready_day_options",
        "cleaning_request_id,is_available",
    )

    option_counts: dict[str, int] = defaultdict(int)

    for option in options:
        if option.get("is_available") is False:
            continue

        request_id = option.get("cleaning_request_id")
        if request_id:
            option_counts[str(request_id)] += 1

    changed = 0
    skipped_final = 0
    skipped_no_options = 0

    print()
    print("Repricing cleaning requests")
    print(f"Mode: {'APPLY' if APPLY else 'DRY RUN'}")
    print(f"Rule: {BONUS_PERCENT:.2f}% bonus only when exactly one ready-day option is available")
    print()

    for request in requests:
        request_id = str(request["id"])
        status = str(request.get("status") or "")

        if status in FINAL_STATUSES or status not in UPDATE_STATUSES:
            skipped_final += 1
            continue

        option_count = option_counts.get(request_id, 0)

        if option_count == 0:
            skipped_no_options += 1
            continue

        subtotal = money(request.get("cleaning_cost_eur")) + money(request.get("travel_cost_eur"))

        should_bonus = option_count == 1
        new_bonus_percent = money(BONUS_PERCENT if should_bonus else 0)
        new_bonus_eur = money(subtotal * (new_bonus_percent / 100))
        new_total = money(subtotal + new_bonus_eur)

        old_bonus_percent = money(request.get("urgency_bonus_percent"))
        old_bonus_eur = money(request.get("urgency_bonus_eur"))
        old_total = money(request.get("total_cost_eur"))
        old_urgent = bool(request.get("urgent"))

        if (
            old_bonus_percent == new_bonus_percent
            and old_bonus_eur == new_bonus_eur
            and old_total == new_total
            and old_urgent == should_bonus
        ):
            continue

        changed += 1

        print(
            f"{request_id} · status={status} · options={option_count} · "
            f"bonus {old_bonus_percent:.2f}%/{old_bonus_eur:.2f}€ -> "
            f"{new_bonus_percent:.2f}%/{new_bonus_eur:.2f}€ · "
            f"total {old_total:.2f}€ -> {new_total:.2f}€"
        )

        if APPLY:
            payload = {
                "urgent": should_bonus,
                "urgency_bonus_percent": new_bonus_percent,
                "urgency_bonus_eur": new_bonus_eur,
                "total_cost_eur": new_total,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("cleaning_requests").update(payload).eq("id", request_id).execute()

    print()
    print(
        f"Summary: changed={changed}, "
        f"skipped_final_or_not_current={skipped_final}, "
        f"skipped_no_ready_options={skipped_no_options}"
    )

    if not APPLY:
        print()
        print("Dry run only. Re-run with APPLY=true to update the database.")


if __name__ == "__main__":
    main()
