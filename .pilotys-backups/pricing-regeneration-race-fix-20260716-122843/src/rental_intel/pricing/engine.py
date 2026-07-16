from __future__ import annotations
from dataclasses import dataclass
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable
from uuid import uuid4
from rental_intel.cleaning.db import get_supabase_client
from rental_intel.pricing.market_signal import load_relative_market_signals

MONEY=Decimal("0.01"); WEEKEND={4,5}
def money(v:Any)->Decimal: return Decimal(str(v or 0)).quantize(MONEY,rounding=ROUND_HALF_UP)
def round_to_increment(value:Any, increment:Any)->Decimal:
 inc=Decimal(str(increment or 1))
 if inc<=0: inc=Decimal("1")
 raw=Decimal(str(value or 0))
 return ((raw/inc).quantize(Decimal("1"),rounding=ROUND_HALF_UP)*inc).quantize(MONEY,rounding=ROUND_HALF_UP)
def parse_date(v:str)->date:return date.fromisoformat(v[:10])
def dates_between(a:date,b:date)->Iterable[date]:
 while a<=b: yield a; a+=timedelta(days=1)

def occupied_dates(rows):
 out=set()
 for r in rows:
  if str(r.get("status") or "").lower() in {"cancelled","canceled"} or not r.get("checkin_at") or not r.get("checkout_at"):continue
  d,e=parse_date(r["checkin_at"]),parse_date(r["checkout_at"])
  while d<e:out.add(d);d+=timedelta(days=1)
 return out

def gap_lengths(start,end,occupied):
 out={}; run=[]
 for d in dates_between(start,end+timedelta(days=1)):
  if d<=end and d not in occupied:run.append(d);continue
  for x in run:out[x]=len(run)
  run=[]
 return out

def choose_period(rows,d):
 matches=[r for r in rows if r.get("active",True) and parse_date(r["start_date"])<=d<=parse_date(r["end_date"])]
 return sorted(matches,key=lambda r:(int(r.get("priority") or 100),parse_date(r["start_date"])),reverse=True)[0] if matches else None

def curve_discount(curve:list[dict[str,Any]], days_before:int)->Decimal:
 pts=sorted([(int(x["days_before"]),Decimal(str(x["discount_pct"]))) for x in curve],reverse=True)
 if not pts:return Decimal("0")
 if days_before>=pts[0][0]:return pts[0][1]
 if days_before<=pts[-1][0]:return pts[-1][1]
 for (d1,p1),(d2,p2) in zip(pts,pts[1:]):
  if d1>=days_before>=d2:
   ratio=Decimal(d1-days_before)/Decimal(d1-d2)
   return p1+(p2-p1)*ratio
 return Decimal("0")

def build_curve_from_preset(preset:str, horizon:int, max_discount:Any)->list[dict[str,Any]]:
 preset=str(preset or "progressive").lower(); h=max(7,int(horizon or 120)); m=Decimal(str(max_discount or 0))
 def point(days:int,pct:Decimal): return {"days_before":int(days),"discount_pct":float(pct)}
 if preset=="none": return [point(h,Decimal("0")),point(0,Decimal("0"))]
 if preset=="linear": return [point(h,Decimal("0")),point(0,m)]
 if preset=="early": return [point(h,Decimal("0")),point(round(h*.75),m*Decimal("0.4")),point(round(h*.5),m*Decimal("0.7")),point(round(h*.25),m*Decimal("0.9")),point(0,m)]
 return [point(h,Decimal("0")),point(round(h*.5),m*Decimal("0.12")),point(round(h*.25),m*Decimal("0.42")),point(min(7,round(h*.12)),m*Decimal("0.82")),point(0,m)]

@dataclass(frozen=True)
class Setting:
 property_id:str; enabled:bool; mode:str; default_price:Decimal; default_weekend_price:Decimal|None; floor_price:Decimal; ceiling_price:Decimal|None; default_min_stay:int; one_night_gap_multiplier:Decimal; one_night_release_days:int; protect_weekends:bool; planning_horizon_days:int; optimisation_curve:list[dict[str,Any]]; optimisation_preset:str; optimisation_horizon_days:int; optimisation_max_discount_pct:Decimal; market_signal_enabled:bool; market_signal_influence_pct:Decimal; market_signal_competitor_id:str; publication_price_increment:Decimal; publication_min_change_eur:Decimal
 @classmethod
 def from_row(cls,r):
  return cls(str(r["property_id"]),bool(r.get("enabled")),str(r.get("mode") or "shadow"),money(r.get("default_price")),money(r["default_weekend_price"]) if r.get("default_weekend_price") is not None else None,money(r.get("floor_price")),money(r["ceiling_price"]) if r.get("ceiling_price") is not None else None,int(r.get("default_min_stay") or 2),Decimal(str(r.get("one_night_gap_multiplier") or 1.5)),int(r.get("one_night_release_days") or 21),bool(r.get("protect_weekends",True)),int(r.get("planning_horizon_days") or 540),list(r.get("optimisation_curve") or []),str(r.get("optimisation_preset") or "progressive"),int(r.get("optimisation_horizon_days") or 120),Decimal(str(r.get("optimisation_max_discount_pct") or 30)),bool(r.get("market_signal_enabled",False)),Decimal(str(r.get("market_signal_influence_pct") or 0)),str(r.get("market_signal_competitor_id") or "le_goyen_hotel"),Decimal(str(r.get("publication_price_increment") or 1)),Decimal(str(r.get("publication_min_change_eur") or 1)))

def step(kind,label,before,after,explanation,details=None):
 return {"kind":kind,"label":label,"before_eur":float(money(before)),"after_eur":float(money(after)),"delta_eur":float(money(after-before)),"explanation":explanation,"details":details or {}}

def calculate_property(*,setting:Setting,seasons,overrides,reservations,today=None,configuration_version_id=None,calendar_version_id=None):
 today=today or datetime.now(timezone.utc).date(); end=today+timedelta(days=setting.planning_horizon_days); occupied=occupied_dates(reservations); gaps=gap_lengths(today,end,occupied); now=datetime.now(timezone.utc); generation_id=str(uuid4())
 market=load_relative_market_signals(setting.market_signal_competitor_id) if setting.market_signal_enabled else {}
 rows=[]
 for d in dates_between(today,end):
  season=choose_period(seasons,d); override=choose_period(overrides,d); weekend=d.weekday() in WEEKEND
  default=setting.default_weekend_price if weekend and setting.default_weekend_price is not None else setting.default_price
  price=default; floor=setting.floor_price; ceiling=setting.ceiling_price; min_stay=setting.default_min_stay; steps=[step("base_plan","Plan général",default,default,"Tarif général du logement, selon le jour de la semaine.")]; reasons=["default_plan"]
  curve=build_curve_from_preset(setting.optimisation_preset,setting.optimisation_horizon_days,setting.optimisation_max_discount_pct); curve_label="Courbe générale"; market_influence=setting.market_signal_influence_pct; protected=False; strategy="base_plan"
  if season:
   season_price=money(season.get("weekend_price") if weekend and season.get("weekend_price") is not None else season.get("weekday_price")); steps.append(step("season_plan",str(season.get("name") or "Saison"),price,season_price,"Cette date appartient à la saison configurée.",{"season_id":season.get("id")})); price=season_price; floor=money(season["floor_price"]) if season.get("floor_price") is not None else floor; ceiling=money(season["ceiling_price"]) if season.get("ceiling_price") is not None else ceiling; min_stay=int(season.get("min_stay") or min_stay)
   optimisation_mode=str(season.get("optimisation_mode") or ("custom" if season.get("optimisation_preset") or season.get("optimisation_curve") else "inherit"))
   # Legacy `none` seasons are migrated logically to a custom flat curve.
   if optimisation_mode=="none":
    optimisation_mode="custom"; season_preset="none"
   else:
    season_preset=str(season.get("optimisation_preset") or "progressive")
   if optimisation_mode=="custom":
    curve=build_curve_from_preset(season_preset,int(season.get("optimisation_horizon_days") or setting.optimisation_horizon_days),season.get("optimisation_max_discount_pct") if season.get("optimisation_max_discount_pct") is not None else setting.optimisation_max_discount_pct)
    curve_label=f"Courbe {season.get('name') or 'saison'} · {season_preset}"
   else:
    curve_label="Courbe générale héritée"
   market_influence=Decimal(str(season.get("market_signal_influence_pct") if season.get("market_signal_influence_pct") is not None else market_influence)); strategy="season_plan"; reasons=["season_plan"]
  if override and (not override.get("hold_until") or datetime.fromisoformat(str(override["hold_until"]).replace("Z","+00:00"))>=now):
   before=price
   if override.get("price") is not None:price=money(override["price"])
   if override.get("floor_price") is not None:floor=money(override["floor_price"])
   if override.get("ceiling_price") is not None:ceiling=money(override["ceiling_price"])
   if override.get("min_stay") is not None:min_stay=int(override["min_stay"])
   steps.append(step("manual_override","Intervention manuelle",before,price,str(override.get("reason") or "Tarif imposé manuellement."))); reasons.append("manual_override");strategy="manual_override"
  is_occupied=d in occupied; days_until=(d-today).days; market_pct=Decimal("0")
  sig=market.get(d)
  if sig and market_influence:
   market_pct=Decimal(str(sig["deviation_pct"]))*market_influence/Decimal("100"); before=price; price=price*(Decimal("1")+market_pct/Decimal("100")); steps.append(step("market_signal","Signal marché Le Goyen",before,price,f"Le Goyen est {sig['deviation_pct']:+.1f}% par rapport à son niveau normal comparable; {float(market_influence):.0f}% de ce mouvement est appliqué.",sig));reasons.append("goyen_relative_market_signal")
  time_pct=Decimal("0")
  if not protected and not (setting.protect_weekends and weekend):
   time_pct=curve_discount(curve,days_until)
   if time_pct>0:
    before=price;price=price*(Decimal("1")-time_pct/Decimal("100"));steps.append(step("time_optimisation",curve_label,before,price,f"{curve_label} prévoit une remise de {float(time_pct):.1f}% à J-{days_until}." + (" Cette date est déjà occupée : le prix est affiché à titre théorique et ne sera pas publié." if is_occupied else ""),{"days_before":days_until,"discount_pct":float(time_pct),"curve":curve,"curve_source":curve_label,"theoretical_only":is_occupied}));reasons.append("time_curve");strategy="time_optimisation"
  unclamped=price; price=max(floor,price); price=min(price,ceiling) if ceiling is not None else price
  if money(price)!=money(unclamped):steps.append(step("guardrail","Plancher / plafond",unclamped,price,"Le prix est ramené dans les limites autorisées.",{"floor":float(floor),"ceiling":float(ceiling) if ceiling is not None else None}));reasons.append("guardrail")
  gap=gaps.get(d)
  if not is_occupied and gap==1 and days_until<=setting.one_night_release_days:
   before=price;price=max(floor,price*setting.one_night_gap_multiplier);price=min(price,ceiling) if ceiling is not None else price;min_stay=1;steps.append(step("premium_single_night","Nuit isolée",before,price,f"Cette nuit est isolée et vendue avec une prime de x{setting.one_night_gap_multiplier}.",{"gap_length":1}));reasons.append("one_night_gap_premium");strategy="premium_single_night"
  rows.append({"property_id":setting.property_id,"date":d.isoformat(),"available":not is_occupied,"occupied":is_occupied,"base_price":float(money(default if not season else (season.get('weekend_price') if weekend and season.get('weekend_price') is not None else season.get('weekday_price')))),"strategy_adjustment":float(money(price-(default if not season else money(season.get('weekend_price') if weekend and season.get('weekend_price') is not None else season.get('weekday_price'))))),"final_price":float(money(price)),"floor_price":float(floor),"ceiling_price":float(ceiling) if ceiling is not None else None,"min_stay":min_stay,"strategy":strategy,"decay_step":0,"gap_length":gap,"source_season_id":season.get("id") if season else None,"reason_codes":reasons,"calculation":{"weekend":weekend,"days_until_arrival":days_until,"mode":setting.mode},"explanation_steps":steps,"market_signal_pct":float(market_pct),"time_discount_pct":float(time_pct),"generation_id":generation_id,"calculated_at":now.isoformat(),"publication_status":"not_required" if is_occupied or not setting.enabled else "pending","configuration_version_id":configuration_version_id,"calendar_version_id":calendar_version_id})
 return rows

def snapshot_configuration(db,property_id,created_by=None,change_summary=None,rolled_back_from=None):
 settings=(db.table("pricing_property_settings").select("*").eq("property_id",property_id).single().execute().data)
 seasons=db.table("pricing_seasons").select("*").eq("property_id",property_id).eq("active",True).order("start_date").execute().data or []
 current=db.table("pricing_configuration_versions").select("version_number").eq("property_id",property_id).order("version_number",desc=True).limit(1).execute().data or []
 version=(int(current[0]["version_number"])+1) if current else 1
 db.table("pricing_configuration_versions").update({"status":"superseded"}).eq("property_id",property_id).eq("status","active").execute()
 return db.table("pricing_configuration_versions").insert({"property_id":property_id,"version_number":version,"status":"active","settings_snapshot":settings,"seasons_snapshot":seasons,"change_summary":change_summary,"created_by":created_by,"rolled_back_from_version_id":rolled_back_from}).execute().data[0]

def regenerate(property_id:str,created_by=None,change_summary=None,configuration_version=None):
 db=get_supabase_client(); raw=db.table("pricing_property_settings").select("*").eq("property_id",property_id).single().execute().data; setting=Setting.from_row(raw)
 config=configuration_version or snapshot_configuration(db,property_id,created_by,change_summary)
 seasons=db.table("pricing_seasons").select("*").eq("property_id",property_id).eq("active",True).execute().data or []; overrides=db.table("pricing_date_overrides").select("*").eq("property_id",property_id).eq("active",True).execute().data or []; reservations=db.table("reservations").select("checkin_at,checkout_at,status").eq("property_id",property_id).execute().data or []
 previous=db.table("pricing_daily_prices").select("date,final_price,min_stay,published_price,published_min_stay,published_at,publication_status").eq("property_id",property_id).execute().data or []; old={str(x["date"]):x for x in previous}
 today=datetime.now(timezone.utc).date(); end=today+timedelta(days=setting.planning_horizon_days)
 db.table("pricing_calendar_versions").update({"status":"superseded"}).eq("property_id",property_id).eq("status","active").execute()
 cv=db.table("pricing_calendar_versions").insert({"property_id":property_id,"configuration_version_id":config["id"],"status":"active","date_from":today.isoformat(),"date_to":end.isoformat()}).execute().data[0]
 rows=calculate_property(setting=setting,seasons=seasons,overrides=overrides,reservations=reservations,configuration_version_id=config["id"],calendar_version_id=cv["id"])
 changed=sum(1 for r in rows if str(r["date"]) not in old or money(old[str(r["date"])].get("final_price"))!=money(r["final_price"]) or int(old[str(r["date"])].get("min_stay") or 0)!=int(r["min_stay"]))

 # Keep the exact explainable price in the calendar, but publish a stable rounded
 # target and ignore changes smaller than the owner's meaningful-change threshold.
 for r in rows:
  prior=old.get(str(r["date"])) or {}
  r["published_price"]=prior.get("published_price")
  r["published_min_stay"]=prior.get("published_min_stay")
  r["published_at"]=prior.get("published_at")
  if r["publication_status"]=="not_required":
   continue
  target=round_to_increment(r["final_price"],setting.publication_price_increment)
  published=money(prior.get("published_price")) if prior.get("published_price") is not None else None
  same_stay=published is not None and int(prior.get("published_min_stay") or 1)==int(r["min_stay"])
  meaningful=published is None or abs(target-published)>=setting.publication_min_change_eur
  r["publication_status"]="pending" if (not same_stay or meaningful) else "published"

 db.table("pricing_publication_actions").update({"status":"superseded","updated_at":datetime.now(timezone.utc).isoformat()}).eq("property_id",property_id).eq("status","proposed").execute()
 db.table("pricing_daily_prices").upsert(rows,on_conflict="property_id,date").execute()

 actions=[]
 for r in rows:
  if r["publication_status"]!="pending":continue
  prior=old.get(str(r["date"])) or {}
  target=round_to_increment(r["final_price"],setting.publication_price_increment)
  actions.append({"property_id":property_id,"date":r["date"],"action_type":"set_price_and_min_stay","status":"proposed","mode":setting.mode,"old_price":prior.get("published_price"),"target_price":float(target),"old_min_stay":prior.get("published_min_stay"),"target_min_stay":r["min_stay"],"reason_codes":r["reason_codes"],"reason":" → ".join(s["label"] for s in r["explanation_steps"]),"generation_id":r["generation_id"],"payload":{"calendar_version_id":cv["id"],"configuration_version_id":config["id"],"calculated_price":r["final_price"],"publication_price_increment":float(setting.publication_price_increment),"publication_min_change_eur":float(setting.publication_min_change_eur),"explanation_steps":r["explanation_steps"]}})
 if actions:db.table("pricing_publication_actions").insert(actions).execute()
 db.table("pricing_calendar_versions").update({"changed_dates":changed,"summary":{"changed_dates":changed,"total_dates":len(rows),"publication_actions":len(actions)}}).eq("id",cv["id"]).execute()
 return {"property_id":property_id,"configuration_version_id":config["id"],"configuration_version_number":config["version_number"],"calendar_version_id":cv["id"],"changed_dates":changed,"publication_actions":len(actions),"total_dates":len(rows)}

def rollback(property_id:str,target_version_id:str,created_by=None):
 db=get_supabase_client(); target=db.table("pricing_configuration_versions").select("*").eq("id",target_version_id).eq("property_id",property_id).single().execute().data
 settings=dict(target["settings_snapshot"]);settings.pop("updated_at",None);settings["property_id"]=property_id;settings["updated_at"]=datetime.now(timezone.utc).isoformat();db.table("pricing_property_settings").upsert(settings,on_conflict="property_id").execute()
 db.table("pricing_seasons").update({"active":False,"updated_at":datetime.now(timezone.utc).isoformat()}).eq("property_id",property_id).eq("active",True).execute()
 seasons=[]
 for s in target.get("seasons_snapshot") or []:
  x=dict(s);x.pop("id",None);x.pop("created_at",None);x["property_id"]=property_id;x["active"]=True;x["updated_at"]=datetime.now(timezone.utc).isoformat();seasons.append(x)
 if seasons:db.table("pricing_seasons").insert(seasons).execute()
 config=snapshot_configuration(db,property_id,created_by,f"Rollback vers la version {target['version_number']}",target_version_id)
 return regenerate(property_id,created_by,configuration_version=config)
