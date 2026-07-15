from __future__ import annotations
from datetime import date, timedelta, datetime, timezone
from typing import Any
from rental_intel.cleaning.db import get_supabase_client
from rental_intel.ingest.beds24 import Beds24Client


def _source_link(db, property_id: str) -> tuple[int,int]:
    rows=(db.table("property_source_links").select("source_property_id,source_room_id").eq("property_id",property_id).eq("source_system","beds24").eq("active",True).execute().data or [])
    if not rows: raise RuntimeError(f"No active Beds24 source link for property {property_id}")
    return int(rows[0]["source_property_id"]), int(rows[0]["source_room_id"])


def _extract_total(response: Any) -> float | None:
    def walk(x: Any):
        if isinstance(x,dict):
            for key in ("price","totalPrice","priceTotal","total"):
                if key in x and isinstance(x[key],(int,float)): return float(x[key])
            for v in x.values():
                found=walk(v)
                if found is not None:return found
        if isinstance(x,list):
            for v in x:
                found=walk(v)
                if found is not None:return found
        return None
    return walk(response)


def publish(property_id: str | None=None, limit: int=100, dry_run: bool=False) -> int:
    db=get_supabase_client(); q=db.table("pricing_actions").select("*").eq("status","proposed").eq("mode","apply").order("date").limit(limit)
    if property_id:q=q.eq("property_id",property_id)
    actions=q.execute().data or []; client=None if dry_run else Beds24Client(); applied=0
    for action in actions:
        try:
            prop,room=_source_link(db,action["property_id"]); d=date.fromisoformat(action["date"]); departure=(d+timedelta(days=1)).isoformat()
            payload=[{"roomId":room,"calendar":[{"from":d.isoformat(),"to":d.isoformat(),"price1":float(action["target_price"]),"minStay":int(action["target_min_stay"])}]}]
            if dry_run:
                print(payload); continue
            db.table("pricing_actions").update({"status":"applying"}).eq("id",action["id"]).execute()
            response=client.post("/inventory/rooms/calendar",json_data=payload)
            after=client.get_offers(property_id=prop,room_id=room,arrival=d.isoformat(),departure=departure,num_adults=2,num_children=0)
            total=_extract_total(after)
            # One-night validation accepts the target with a one-cent tolerance. If Beds24 adds fees, retain raw response and fail safely.
            if total is None or abs(total-float(action["target_price"])) > .01:
                raise RuntimeError(f"Validation mismatch: expected {action['target_price']}, effective quote {total}")
            db.table("pricing_actions").update({"status":"applied","payload":payload,"response":{"write":response,"offer_after":after},"applied_at":datetime.now(timezone.utc).isoformat(),"error":None}).eq("id",action["id"]).execute()
            db.table("pricing_daily_prices").update({"published_price":action["target_price"],"published_min_stay":action["target_min_stay"],"published_at":datetime.now(timezone.utc).isoformat(),"publication_status":"published"}).eq("property_id",action["property_id"]).eq("date",action["date"]).execute(); applied+=1
        except Exception as exc:
            db.table("pricing_actions").update({"status":"validation_failed","error":str(exc)}).eq("id",action["id"]).execute()
            db.table("pricing_daily_prices").update({"publication_status":"failed"}).eq("property_id",action["property_id"]).eq("date",action["date"]).execute()
    return applied
