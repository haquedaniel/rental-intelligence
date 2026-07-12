from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv

from rental_intel.cleaning.db import get_supabase_client

try:
    from rental_intel.cleaning.event_log import log_operational_event
except Exception:  # pragma: no cover
    log_operational_event = None


ROOT = Path(__file__).resolve().parents[3]
PROCESSED = ROOT / "outputs" / "processed"


@dataclass
class Config:
    listing_id: str
    enabled: bool
    active_from: date | None
    active_to: date | None
    mode: str
    max_discount_pct: float
    max_daily_change_pct: float
    min_days_before_arrival: int
    max_days_before_arrival: int
    allow_min_stay_changes: bool
    require_post_write_validation: bool


@dataclass
class FloorRule:
    listing_id: str
    start_date: date
    end_date: date
    floor_price_eur: float
    target_min_stay: int | None


def parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def parse_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def parse_int(value: Any, default: int | None = None) -> int | None:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def load_gap_offers() -> pd.DataFrame:
    path = PROCESSED / "gap_offers.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run extract_gap_offers first.")

    df = pd.read_csv(path)

    # Backward compatibility with the old exact-gap-only file.
    if "option_type" not in df.columns:
        df["option_type"] = "full_gap"
    if "strategy" not in df.columns:
        df["strategy"] = "sell_full_gap"
    if "offer_start" not in df.columns:
        df["offer_start"] = df["gap_start"]
    if "offer_end" not in df.columns:
        df["offer_end"] = df["gap_end"]
    if "offer_nights" not in df.columns:
        df["offer_nights"] = df["gap_nights"]

    df["bookable"] = df["bookable"].astype(str).str.lower().isin(["true", "1", "yes"])
    df["gap_start_date"] = pd.to_datetime(df["gap_start"]).dt.date
    df["offer_start_date"] = pd.to_datetime(df["offer_start"]).dt.date
    df["effective_price_per_night"] = pd.to_numeric(
        df["effective_price_per_night"], errors="coerce"
    )
    df["offer_price"] = pd.to_numeric(df["offer_price"], errors="coerce")

    return df


def fetch_configs(supabase) -> dict[str, Config]:
    rows = supabase.table("pricing_autopilot_config").select("*").execute().data or []
    configs: dict[str, Config] = {}

    for row in rows:
        configs[str(row["listing_id"])] = Config(
            listing_id=str(row["listing_id"]),
            enabled=bool(row.get("enabled")),
            active_from=parse_date(row.get("active_from")),
            active_to=parse_date(row.get("active_to")),
            mode=str(row.get("mode") or "shadow"),
            max_discount_pct=parse_float(row.get("max_discount_pct"), 20),
            max_daily_change_pct=parse_float(row.get("max_daily_change_pct"), 10),
            min_days_before_arrival=int(row.get("min_days_before_arrival") or 1),
            max_days_before_arrival=int(row.get("max_days_before_arrival") or 45),
            allow_min_stay_changes=bool(row.get("allow_min_stay_changes")),
            require_post_write_validation=bool(row.get("require_post_write_validation", True)),
        )

    return configs


def fetch_floor_rules(supabase) -> list[FloorRule]:
    rows = (
        supabase.table("pricing_floor_rules")
        .select("*")
        .eq("active", True)
        .execute()
        .data
        or []
    )

    rules: list[FloorRule] = []
    for row in rows:
        start = parse_date(row.get("start_date"))
        end = parse_date(row.get("end_date"))
        if not start or not end:
            continue

        rules.append(
            FloorRule(
                listing_id=str(row["listing_id"]),
                start_date=start,
                end_date=end,
                floor_price_eur=parse_float(row.get("floor_price_eur")),
                target_min_stay=parse_int(row.get("target_min_stay")),
            )
        )

    return rules


def find_floor(rules: list[FloorRule], listing_id: str, d: date) -> FloorRule | None:
    matches = [
        r for r in rules
        if r.listing_id == listing_id and r.start_date <= d <= r.end_date
    ]
    if not matches:
        return None
    # Prefer the most specific/latest rule.
    return sorted(matches, key=lambda r: (r.start_date, r.end_date), reverse=True)[0]


def discount_for_days(days_until: int, max_discount_pct: float) -> float:
    """
    Returns percentage discount for full-gap pricing.
    """
    if days_until > 30:
        return 0.0
    if days_until >= 15:
        return min(5.0, max_discount_pct)
    if days_until >= 8:
        return min(10.0, max_discount_pct)
    if days_until >= 4:
        return min(15.0, max_discount_pct)
    if days_until >= 1:
        return min(20.0, max_discount_pct)
    return min(25.0, max_discount_pct)


def is_rescue_window(days_until: int) -> bool:
    return days_until <= 7


def round_price(value: float) -> float:
    # Round to whole euros for now.
    return float(round(value))


def choose_action_for_gap(
    group: pd.DataFrame,
    config: Config,
    floor: FloorRule,
    today: date,
    run_id: str,
) -> dict[str, Any] | None:
    listing_id = str(group.iloc[0]["listing_id"])
    gap_start = parse_date(group.iloc[0]["gap_start"])
    gap_end = parse_date(group.iloc[0]["gap_end"])
    gap_nights = int(group.iloc[0]["gap_nights"])

    if not gap_start or not gap_end:
        return None

    days_until = (gap_start - today).days

    if config.active_from and gap_start < config.active_from:
        return None
    if config.active_to and gap_start > config.active_to:
        return None
    if days_until < config.min_days_before_arrival:
        return None
    if days_until > config.max_days_before_arrival:
        return None

    full = group[group["option_type"] == "full_gap"].copy()
    one_night_options = group[group["strategy"] == "one_night_rescue"].copy()

    full_price = None
    full_bookable = False

    if not full.empty:
        full_row = full.iloc[0]
        full_bookable = bool(full_row["bookable"])
        full_price = (
            float(full_row["effective_price_per_night"])
            if pd.notna(full_row["effective_price_per_night"])
            else None
        )

    # Reference price for premium 1-night logic.
    reference_nightly = full_price or floor.floor_price_eur
    premium_one_night_price = round_price(max(
        floor.floor_price_eur,
        reference_nightly * 1.5,
    ))

    # If it is a 1-night gap, it is always an orphan-night product.
    if gap_nights == 1:
        current_price = full_price
        if current_price is None:
            current_price = floor.floor_price_eur

        recommended = max(premium_one_night_price, floor.floor_price_eur)

        # Avoid creating a pointless action if current price is already at/above target.
        if full_bookable and current_price >= recommended:
            return None

        return {
            "run_id": run_id,
            "listing_id": listing_id,
            "date": gap_start.isoformat(),
            "action_type": "price_and_min_stay_change" if config.allow_min_stay_changes else "price_change",
            "status": "proposed",
            "mode": config.mode,
            "current_price_eur": current_price,
            "recommended_price_eur": recommended,
            "floor_price_eur": floor.floor_price_eur,
            "current_min_stay": None,
            "recommended_min_stay": 1 if config.allow_min_stay_changes else None,
            "discount_pct": None,
            "reason_code": "one_night_premium_gap",
            "reason": (
                f"{listing_id}: 1-night gap {gap_start} → {gap_end}. "
                f"Price as premium orphan night at about 150% of reference nightly price."
            ),
            "beds24_payload": {
                "strategy": "one_night_premium_gap",
                "gap_start": gap_start.isoformat(),
                "gap_end": gap_end.isoformat(),
                "gap_nights": gap_nights,
                "risk_note": "Shadow action only. Writeback must validate Beds24 offer after override.",
            },
            "validation_before": {
                "full_gap_bookable": full_bookable,
                "full_gap_price_per_night": full_price,
                "options": group.to_dict(orient="records"),
            },
        }

    # For 2+ night gaps, decide whether we are still protecting the full gap
    # or allowing one-night rescue.
    if gap_nights >= 2 and is_rescue_window(days_until) and not one_night_options.empty:
        one_bookable = one_night_options[one_night_options["bookable"] == True].copy()

        # Pick the first available one-night rescue option for now.
        chosen = one_bookable.iloc[0] if not one_bookable.empty else one_night_options.iloc[0]
        current_price = (
            float(chosen["effective_price_per_night"])
            if pd.notna(chosen["effective_price_per_night"])
            else None
        )

        recommended = premium_one_night_price

        return {
            "run_id": run_id,
            "listing_id": listing_id,
            "date": parse_date(chosen["offer_start"]).isoformat(),
            "action_type": "price_and_min_stay_change" if config.allow_min_stay_changes else "price_change",
            "status": "proposed",
            "mode": config.mode,
            "current_price_eur": current_price,
            "recommended_price_eur": recommended,
            "floor_price_eur": floor.floor_price_eur,
            "current_min_stay": None,
            "recommended_min_stay": 1 if config.allow_min_stay_changes else None,
            "discount_pct": None,
            "reason_code": "one_night_rescue",
            "reason": (
                f"{listing_id}: {gap_nights}-night gap {gap_start} → {gap_end} is close "
                f"(J-{days_until}). Allow one-night rescue at premium price."
            ),
            "beds24_payload": {
                "strategy": "one_night_rescue",
                "gap_start": gap_start.isoformat(),
                "gap_end": gap_end.isoformat(),
                "gap_nights": gap_nights,
                "selected_offer_start": str(chosen["offer_start"]),
                "selected_offer_end": str(chosen["offer_end"]),
                "risk_note": (
                    "If Beds24 writeback cannot target a separate 1-night gap-filler rate, "
                    "a calendar override may also affect 2-night pricing. Validate before marking applied."
                ),
            },
            "validation_before": {
                "full_gap_bookable": full_bookable,
                "full_gap_price_per_night": full_price,
                "selected_option": chosen.to_dict(),
                "all_options": group.to_dict(orient="records"),
            },
        }

    # Otherwise optimise/protect the full gap.
    if full_price is None:
        return None

    discount = discount_for_days(days_until, config.max_discount_pct)
    recommended = round_price(max(
        floor.floor_price_eur,
        full_price * (1 - discount / 100),
    ))

    # Avoid noise if recommendation equals or exceeds current.
    if recommended >= full_price:
        return None

    return {
        "run_id": run_id,
        "listing_id": listing_id,
        "date": gap_start.isoformat(),
        "action_type": "price_change",
        "status": "proposed",
        "mode": config.mode,
        "current_price_eur": full_price,
        "recommended_price_eur": recommended,
        "floor_price_eur": floor.floor_price_eur,
        "current_min_stay": None,
        "recommended_min_stay": min(gap_nights, floor.target_min_stay) if floor.target_min_stay else None,
        "discount_pct": discount,
        "reason_code": "full_gap_time_discount",
        "reason": (
            f"{listing_id}: {gap_nights}-night gap {gap_start} → {gap_end}, "
            f"J-{days_until}. Recommend controlled time-based discount."
        ),
        "beds24_payload": {
            "strategy": "sell_full_gap",
            "gap_start": gap_start.isoformat(),
            "gap_end": gap_end.isoformat(),
            "gap_nights": gap_nights,
        },
        "validation_before": {
            "full_gap_bookable": full_bookable,
            "full_gap_price_per_night": full_price,
            "all_options": group.to_dict(orient="records"),
        },
    }


def log_event(supabase, run_id: str, title: str, summary: str, severity: str = "info") -> None:
    if not log_operational_event:
        return

    try:
        log_operational_event(
            supabase,
            event_type="pricing_gap_actions_generated",
            severity=severity,
            source="pricing",
            job_name="generate_gap_pricing_actions",
            run_id=run_id,
            title=title,
            summary=summary,
            reason_code="pricing_actions_generated",
            event_key=f"pricing_gap_actions_generated:{run_id}",
        )
    except TypeError:
        # Older helper signature fallback.
        return
    except Exception:
        return


def main() -> None:
    load_dotenv(ROOT / ".env", override=True)

    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%dT%H%M%SZ")
    today = now.date()

    supabase = get_supabase_client()
    configs = fetch_configs(supabase)
    floor_rules = fetch_floor_rules(supabase)
    gap_offers = load_gap_offers()

    actions: list[dict[str, Any]] = []
    skipped = 0

    group_cols = ["listing_id", "gap_start", "gap_end", "gap_nights"]

    for keys, group in gap_offers.groupby(group_cols, dropna=False):
        listing_id = str(keys[0])
        gap_start = parse_date(keys[1])

        config = configs.get(listing_id)
        if not config or not config.enabled:
            skipped += 1
            continue

        if not gap_start:
            skipped += 1
            continue

        floor = find_floor(floor_rules, listing_id, gap_start)
        if not floor:
            skipped += 1
            continue

        action = choose_action_for_gap(
            group=group.copy(),
            config=config,
            floor=floor,
            today=today,
            run_id=run_id,
        )

        if action:
            actions.append(action)
        else:
            skipped += 1

    if actions:
        supabase.table("pricing_actions").insert(actions).execute()

    summary = f"Created {len(actions)} pricing action(s); skipped {skipped} gap(s)."
    print(summary)

    if actions:
        print(pd.DataFrame(actions)[
            [
                "listing_id",
                "date",
                "mode",
                "action_type",
                "current_price_eur",
                "recommended_price_eur",
                "recommended_min_stay",
                "reason_code",
                "reason",
            ]
        ].to_string(index=False))

    log_event(
        supabase=supabase,
        run_id=run_id,
        title="Gap pricing actions generated",
        summary=summary,
        severity="info",
    )


if __name__ == "__main__":
    main()
