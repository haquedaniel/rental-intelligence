from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable
from uuid import uuid4

from rental_intel.cleaning.db import get_supabase_client

MONEY = Decimal("0.01")
WEEKEND = {4, 5}  # Friday, Saturday


def money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def dates_between(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def parse_date(value: str) -> date:
    return date.fromisoformat(value[:10])


@dataclass(frozen=True)
class Setting:
    property_id: str
    enabled: bool
    mode: str
    default_price: Decimal
    default_weekend_price: Decimal | None
    floor_price: Decimal
    ceiling_price: Decimal | None
    default_min_stay: int
    weekly_decay_amount: Decimal
    weekly_decay_max_steps: int
    decay_starts_days_before_arrival: int
    one_night_gap_multiplier: Decimal
    one_night_release_days: int
    protect_weekends: bool
    planning_horizon_days: int
    strategy_started_at: datetime

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Setting":
        return cls(
            property_id=str(row["property_id"]), enabled=bool(row.get("enabled")), mode=str(row.get("mode") or "shadow"),
            default_price=money(row.get("default_price")),
            default_weekend_price=money(row["default_weekend_price"]) if row.get("default_weekend_price") is not None else None,
            floor_price=money(row.get("floor_price")), ceiling_price=money(row["ceiling_price"]) if row.get("ceiling_price") is not None else None,
            default_min_stay=int(row.get("default_min_stay") or 2), weekly_decay_amount=money(row.get("weekly_decay_amount") or 0),
            weekly_decay_max_steps=int(row.get("weekly_decay_max_steps") or 0), decay_starts_days_before_arrival=int(row.get("decay_starts_days_before_arrival") or 120),
            one_night_gap_multiplier=Decimal(str(row.get("one_night_gap_multiplier") or 1.5)), one_night_release_days=int(row.get("one_night_release_days") or 21),
            protect_weekends=bool(row.get("protect_weekends", True)), planning_horizon_days=int(row.get("planning_horizon_days") or 540),
            strategy_started_at=datetime.fromisoformat(str(row.get("strategy_started_at") or datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")),
        )


def choose_period(rows: list[dict[str, Any]], d: date) -> dict[str, Any] | None:
    matching = [r for r in rows if bool(r.get("active", True)) and parse_date(r["start_date"]) <= d <= parse_date(r["end_date"])]
    return sorted(matching, key=lambda r: (int(r.get("priority") or 100), parse_date(r["start_date"])), reverse=True)[0] if matching else None


def occupied_dates(reservations: list[dict[str, Any]]) -> set[date]:
    result: set[date] = set()
    for row in reservations:
        if str(row.get("status") or "").lower() in {"cancelled", "canceled"}: continue
        if not row.get("checkin_at") or not row.get("checkout_at"): continue
        start, end = parse_date(row["checkin_at"]), parse_date(row["checkout_at"])
        current = start
        while current < end:
            result.add(current); current += timedelta(days=1)
    return result


def gap_lengths(start: date, end: date, occupied: set[date]) -> dict[date, int]:
    result: dict[date, int] = {}; run: list[date] = []
    for d in dates_between(start, end + timedelta(days=1)):
        if d <= end and d not in occupied: run.append(d); continue
        for item in run: result[item] = len(run)
        run = []
    return result


def calculate_property(*, setting: Setting, seasons: list[dict[str, Any]], overrides: list[dict[str, Any]], reservations: list[dict[str, Any]], today: date | None = None) -> list[dict[str, Any]]:
    today = today or datetime.now(timezone.utc).date(); end = today + timedelta(days=setting.planning_horizon_days)
    occupied = occupied_dates(reservations); gaps = gap_lengths(today, end, occupied); generation_id = str(uuid4()); now = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []

    for d in dates_between(today, end):
        season = choose_period(seasons, d); override = choose_period(overrides, d)
        weekend = d.weekday() in WEEKEND
        base = setting.default_weekend_price if weekend and setting.default_weekend_price is not None else setting.default_price
        floor, ceiling, min_stay = setting.floor_price, setting.ceiling_price, setting.default_min_stay
        reasons = ["default_plan"]
        if season:
            base = money(season.get("weekend_price") if weekend and season.get("weekend_price") is not None else season.get("weekday_price"))
            floor = money(season.get("floor_price")) if season.get("floor_price") is not None else floor
            ceiling = money(season.get("ceiling_price")) if season.get("ceiling_price") is not None else ceiling
            min_stay = int(season.get("min_stay") or min_stay); reasons = ["season_plan"]
        if override and (not override.get("hold_until") or datetime.fromisoformat(str(override["hold_until"]).replace("Z", "+00:00")) >= now):
            if override.get("price") is not None: base = money(override["price"])
            if override.get("floor_price") is not None: floor = money(override["floor_price"])
            if override.get("ceiling_price") is not None: ceiling = money(override["ceiling_price"])
            if override.get("min_stay") is not None: min_stay = int(override["min_stay"])
            reasons.append("manual_override")

        is_occupied = d in occupied
        gap = gaps.get(d)
        adjustment = Decimal("0")
        decay_step = 0
        # Strategy describes the active source/optimisation, not merely the default engine path.
        strategy = "season_plan" if season else "base_plan"
        if override:
            strategy = "manual_override"
        days_until = (d - today).days
        if not is_occupied and days_until <= setting.decay_starts_days_before_arrival and not (setting.protect_weekends and weekend):
            entered_window = datetime.combine(
                d - timedelta(days=setting.decay_starts_days_before_arrival),
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            decay_clock_start = max(setting.strategy_started_at, entered_window)
            decay_step = min(max(0, (now - decay_clock_start).days // 7), setting.weekly_decay_max_steps)
            adjustment -= setting.weekly_decay_amount * decay_step
            if decay_step: strategy = "open_inventory_decay"; reasons.append("weekly_decay")
        normal_target = max(floor, base + adjustment)
        if ceiling is not None: normal_target = min(normal_target, ceiling)
        final = normal_target
        if not is_occupied and gap == 1 and days_until <= setting.one_night_release_days:
            min_stay = 1; final = max(floor, normal_target * setting.one_night_gap_multiplier); strategy = "premium_single_night"; reasons.append("one_night_gap_premium")
            if ceiling is not None: final = min(final, ceiling)
        publication_status = "not_required" if is_occupied or not setting.enabled else "pending"
        rows.append({
            "property_id": setting.property_id, "date": d.isoformat(), "available": not is_occupied, "occupied": is_occupied,
            "base_price": float(base), "strategy_adjustment": float(adjustment), "final_price": float(money(final)), "floor_price": float(floor),
            "ceiling_price": float(ceiling) if ceiling is not None else None, "min_stay": min_stay, "strategy": strategy, "decay_step": decay_step,
            "gap_length": gap, "source_season_id": season.get("id") if season else None, "reason_codes": reasons,
            "calculation": {"weekend": weekend, "days_until_arrival": days_until, "normal_target": float(money(normal_target)), "mode": setting.mode},
            "generation_id": generation_id, "calculated_at": now.isoformat(), "publication_status": publication_status,
        })
    return rows


def _same_target(action: dict[str, Any], row: dict[str, Any]) -> bool:
    return (
        money(action.get("target_price")) == money(row.get("final_price"))
        and int(action.get("target_min_stay") or 0) == int(row.get("min_stay") or 0)
    )


def regenerate(property_id: str | None = None) -> int:
    db = get_supabase_client()
    query = db.table("pricing_property_settings").select("*")
    if property_id:
        query = query.eq("property_id", property_id)

    settings = query.execute().data or []
    total = 0

    for raw in settings:
        now = datetime.now(timezone.utc)
        setting = Setting.from_row(raw)
        seasons = (
            db.table("pricing_seasons")
            .select("*")
            .eq("property_id", setting.property_id)
            .eq("active", True)
            .execute()
            .data
            or []
        )
        overrides = (
            db.table("pricing_date_overrides")
            .select("*")
            .eq("property_id", setting.property_id)
            .eq("active", True)
            .execute()
            .data
            or []
        )
        reservations = (
            db.table("reservations")
            .select("checkin_at,checkout_at,status")
            .eq("property_id", setting.property_id)
            .execute()
            .data
            or []
        )

        new_rows = calculate_property(
            setting=setting,
            seasons=seasons,
            overrides=overrides,
            reservations=reservations,
        )

        previous_rows = (
            db.table("pricing_daily_prices")
            .select(
                "date,final_price,min_stay,published_price,published_min_stay,"
                "published_at,publication_status"
            )
            .eq("property_id", setting.property_id)
            .execute()
            .data
            or []
        )
        old = {str(row["date"]): row for row in previous_rows}

        open_actions = (
            db.table("pricing_publication_actions")
            .select("id,date,status,target_price,target_min_stay")
            .eq("property_id", setting.property_id)
            .in_("status", ["proposed", "applying"])
            .execute()
            .data
            or []
        )
        open_by_date = {str(row["date"]): row for row in open_actions}

        actions: list[dict[str, Any]] = []
        proposals_to_supersede: list[str] = []

        for row in new_rows:
            prior = old.get(str(row["date"]))

            # Preserve a successful publication when the published target still matches.
            if row["publication_status"] == "pending" and prior:
                published_price = prior.get("published_price")
                published_min_stay = prior.get("published_min_stay")
                if (
                    published_price is not None
                    and published_min_stay is not None
                    and money(published_price) == money(row["final_price"])
                    and int(published_min_stay) == int(row["min_stay"])
                ):
                    row["publication_status"] = "published"
                    row["published_price"] = published_price
                    row["published_min_stay"] = published_min_stay
                    row["published_at"] = prior.get("published_at")

            if row["publication_status"] != "pending":
                continue

            # A changed target is no longer represented by any previous successful
            # publication, so clear stale publication metadata in the daily ledger.
            row["published_price"] = None
            row["published_min_stay"] = None
            row["published_at"] = None

            existing_action = open_by_date.get(str(row["date"]))
            if existing_action:
                if _same_target(existing_action, row):
                    # An interrupted rerun may already have created the correct queue item.
                    continue
                if str(existing_action.get("status")) == "applying":
                    # Do not race an in-flight publisher. A later run will reconcile it.
                    continue
                proposals_to_supersede.append(str(existing_action["id"]))

            actions.append(
                {
                    "property_id": setting.property_id,
                    "date": row["date"],
                    "action_type": "set_price_and_min_stay",
                    "status": "proposed",
                    "mode": setting.mode,
                    "old_price": prior.get("final_price") if prior else None,
                    "target_price": row["final_price"],
                    "old_min_stay": prior.get("min_stay") if prior else None,
                    "target_min_stay": row["min_stay"],
                    "reason_codes": row["reason_codes"],
                    "reason": f"{row['strategy']}: {', '.join(row['reason_codes'])}",
                    "generation_id": row["generation_id"],
                    "payload": {
                        "strategy": row["strategy"],
                        "source_season_id": row.get("source_season_id"),
                    },
                }
            )

        # Upsert after publication-state reconciliation so an unchanged published row
        # does not get reset to pending on every regeneration.
        db.table("pricing_daily_prices").upsert(
            new_rows, on_conflict="property_id,date"
        ).execute()

        for action_id in proposals_to_supersede:
            (
                db.table("pricing_publication_actions")
                .update({"status": "superseded", "updated_at": now.isoformat()})
                .eq("id", action_id)
                .eq("status", "proposed")
                .execute()
            )

        if actions:
            db.table("pricing_publication_actions").insert(actions).execute()

        total += len(new_rows)

    return total

