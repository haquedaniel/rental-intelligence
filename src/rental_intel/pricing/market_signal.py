from __future__ import annotations
from datetime import date
from pathlib import Path
from typing import Any
import csv
from statistics import median

ROOT = Path(__file__).resolve().parents[3]
LATEST = ROOT / "outputs" / "processed" / "market_daily_price_snapshots_latest.csv"


def load_relative_market_signals(competitor_id: str = "le_goyen_hotel") -> dict[date, dict[str, Any]]:
    """Return exceptional daily movement, not the hotel's absolute price.

    Each Goyen price is compared with the median of the same weekday within a
    +/- 35-day neighbourhood. This removes most level and ordinary weekday/
    seasonal effects. The result is intentionally only a relative signal.
    """
    if not LATEST.exists():
        return {}
    rows=[]
    with LATEST.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if str(row.get("competitor_id")) != competitor_id:
                continue
            if str(row.get("status")) != "success_available":
                continue
            try:
                d=date.fromisoformat(str(row["date"])[:10]); price=float(row["price"])
            except Exception:
                continue
            rows.append((d, price))
    result={}
    for d, price in rows:
        peers=[p for pd,p in rows if pd.weekday()==d.weekday() and abs((pd-d).days)<=35 and pd != d]
        if len(peers)<3:
            continue
        baseline=median(peers)
        if baseline<=0:
            continue
        deviation=(price/baseline-1)*100
        # Prevent one bad hotel observation dominating the apartment plan.
        deviation=max(-30.0,min(30.0,deviation))
        result[d]={"deviation_pct":round(deviation,2),"observed_price":price,"baseline_price":round(baseline,2),"peer_count":len(peers)}
    return result
