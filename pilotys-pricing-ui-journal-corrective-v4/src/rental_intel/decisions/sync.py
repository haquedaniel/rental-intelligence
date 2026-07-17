from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any
from rental_intel.cleaning.db import get_supabase_client

def now_iso(): return datetime.now(timezone.utc).isoformat()
def text(v): return str(v or '').strip()
def insert(db,payload):
    try:
        db.table('ops_decisions').insert(payload).execute(); return 1
    except Exception as exc:
        if 'duplicate key' in str(exc) or '23505' in str(exc): return 0
        print('WARN ops decision:',exc); return 0

def property_map(db):
    rows=db.table('properties').select('id,owner_id,name').execute().data or []
    return {str(r['id']):r for r in rows if r.get('owner_id')}

def sync_reservations(db, props, since):
    rows=db.table('reservations').select('id,property_id,status,guest_name,channel,checkin_at,checkout_at,nights,number_of_guests,booking_time,modified_time,cancel_time,created_at').gte('created_at',since).execute().data or []
    # Also capture older rows modified/cancelled recently.
    for field in ('modified_time','cancel_time'):
        extra=db.table('reservations').select('id,property_id,status,guest_name,channel,checkin_at,checkout_at,nights,number_of_guests,booking_time,modified_time,cancel_time,created_at').gte(field,since).execute().data or []
        by={str(r['id']):r for r in rows}; by.update({str(r['id']):r for r in extra}); rows=list(by.values())
    n=0
    for r in rows:
        p=props.get(str(r.get('property_id')))
        if not p: continue
        name=text(r.get('guest_name')) or 'Un voyageur'; channel=text(r.get('channel')) or text(r.get('source_system')) or 'plateforme'
        base={'owner_id':p['owner_id'],'property_id':p['id'],'category':'reservation','reservation_id':r['id'],'related_object_type':'reservation','related_object_id':r['id'],'metadata':r}
        if r.get('booking_time') or r.get('created_at'):
            stamp=r.get('booking_time') or r.get('created_at')
            n+=insert(db,{**base,'occurred_at':stamp,'decision_type':'reservation_created','severity':'important','title':'Nouvelle réservation','summary':f"{name} · {p['name']}",'what_happened':f"Nouvelle réservation de {r.get('nights') or '?'} nuit(s) via {channel}.",'why':'Une nouvelle réservation a été reçue.','action_taken':'Le calendrier et les opérations associées sont pris en compte automatiquement.','event_key':f"reservation:created:{r['id']}"})
        if r.get('modified_time'):
            n+=insert(db,{**base,'occurred_at':r['modified_time'],'decision_type':'reservation_modified','severity':'attention','title':'Réservation modifiée','summary':f"{name} · {p['name']}",'what_happened':'Les dates ou informations de la réservation ont été modifiées.','why':'La plateforme de réservation a transmis une mise à jour.','action_taken':'Pilotys a resynchronisé le séjour et les opérations liées.','event_key':f"reservation:modified:{r['id']}:{r['modified_time']}"})
        if text(r.get('status')).lower() in ('cancelled','canceled') or r.get('cancel_time'):
            stamp=r.get('cancel_time') or r.get('modified_time') or now_iso()
            n+=insert(db,{**base,'occurred_at':stamp,'decision_type':'reservation_cancelled','severity':'important','title':'Réservation annulée','summary':f"{name} · {p['name']}",'what_happened':'La réservation a été annulée.','why':'La plateforme de réservation a transmis une annulation.','action_taken':'Les disponibilités et les opérations liées seront recalculées.','event_key':f"reservation:cancelled:{r['id']}:{stamp}"})
    return n

def sync_cleaning(db, props, since):
    rows=db.table('cleaning_requests').select('id,property_id,status,accepted_at,refused_at,planning_changed_at,scheduled_start_at,scheduled_end_at,assigned_cleaner_id,refusal_reason,updated_at').gte('updated_at',since).execute().data or []
    n=0
    for r in rows:
        p=props.get(str(r.get('property_id')))
        if not p: continue
        base={'owner_id':p['owner_id'],'property_id':p['id'],'category':'cleaning','cleaning_request_id':r['id'],'related_object_type':'cleaning_request','related_object_id':r['id'],'metadata':r}
        if r.get('accepted_at'):
            n+=insert(db,{**base,'occurred_at':r['accepted_at'],'decision_type':'cleaner_accepted','title':'Mission acceptée','summary':p['name'],'what_happened':'La personne chargée de la mission a accepté.','why':'La mission proposée a été confirmée.','action_taken':'La mission est maintenant planifiée.','event_key':f"cleaning:accepted:{r['id']}:{r['accepted_at']}"})
        if r.get('refused_at'):
            n+=insert(db,{**base,'occurred_at':r['refused_at'],'decision_type':'cleaner_refused','severity':'attention','title':'Mission refusée','summary':p['name'],'what_happened':'La personne sollicitée a refusé la mission.','why':text(r.get('refusal_reason')) or 'Aucun motif détaillé.','action_taken':'La mission nécessite une nouvelle affectation.','requires_owner_action':True,'event_key':f"cleaning:refused:{r['id']}:{r['refused_at']}"})
        if r.get('planning_changed_at'):
            n+=insert(db,{**base,'occurred_at':r['planning_changed_at'],'decision_type':'cleaning_rescheduled','title':'Mission replanifiée','summary':p['name'],'what_happened':'La date ou la fenêtre de la mission a changé.','why':'Le planning a été recalculé, notamment à la suite d’une évolution des réservations.','action_taken':'Pilotys a mis à jour la mission et son échéance.','event_key':f"cleaning:rescheduled:{r['id']}:{r['planning_changed_at']}"})
    reports=db.table('cleaning_reports').select('id,cleaning_request_id,status,submitted_at,ready_for_guest,ready_for_guests,problem_reported,damage_found,missing_items,linen_problem,consumables_problem,general_notes,comments').gte('submitted_at',since).execute().data or []
    reqids=[r['cleaning_request_id'] for r in reports if r.get('cleaning_request_id')]
    reqmap={}
    if reqids:
        rr=db.table('cleaning_requests').select('id,property_id').in_('id',reqids).execute().data or []; reqmap={str(x['id']):x for x in rr}
    for rep in reports:
        req=reqmap.get(str(rep.get('cleaning_request_id'))); p=props.get(str(req.get('property_id'))) if req else None
        if not p: continue
        photos=db.table('cleaning_report_photos').select('id').eq('cleaning_report_id',rep['id']).execute().data or []
        issue=any(rep.get(k) for k in ('problem_reported','damage_found','missing_items','linen_problem','consumables_problem'))
        n+=insert(db,{'owner_id':p['owner_id'],'property_id':p['id'],'occurred_at':rep['submitted_at'],'category':'cleaning','decision_type':'cleaning_completed','severity':'attention' if issue else 'info','title':'Mission terminée','summary':f"{p['name']} · {len(photos)} photo(s)",'what_happened':'Le compte rendu de mission a été transmis.','why':'La mission prévue a été réalisée.','action_taken':'Les photos et éventuels problèmes sont disponibles dans Pilotys.','requires_owner_action':issue,'cleaning_request_id':rep['cleaning_request_id'],'related_object_type':'cleaning_report','related_object_id':rep['id'],'event_key':f"cleaning:completed:{rep['id']}",'metadata':{**rep,'photo_count':len(photos)}})
    return n

def payload_calendar_version_id(payload: Any) -> str | None:
    """Return the embedded calendar version when publication metadata is preserved.

    Historical/published actions may contain the raw Beds24 request list instead
    of the original metadata object. Those rows are associated by creation-time
    window in sync_pricing() rather than causing the whole decision sync to fail.
    """
    if isinstance(payload, dict):
        value=payload.get('calendar_version_id')
        return str(value) if value else None
    return None

def sync_pricing(db, props, since):
    versions=db.table('pricing_calendar_versions').select('id,property_id,configuration_version_id,changed_dates,summary,created_at').gte('created_at',since).order('created_at').execute().data or []
    configuration_ids=[v.get('configuration_version_id') for v in versions if v.get('configuration_version_id')]
    configurations={}
    if configuration_ids:
        rows=(db.table('pricing_configuration_versions')
              .select('id,created_by,change_summary,rolled_back_from_version_id')
              .in_('id',configuration_ids).execute().data or [])
        configurations={str(row['id']):row for row in rows}
    n=0
    for index,v in enumerate(versions):
        p=props.get(str(v.get('property_id')))
        if not p: continue

        # A publication action initially carries calendar_version_id in its JSON
        # metadata, but after sending it may carry the raw channel request list.
        # Restrict the fallback to the period between this calendar version and
        # the next version for the same property.
        next_created_at=None
        for later in versions[index+1:]:
            if str(later.get('property_id'))==str(v.get('property_id')):
                next_created_at=later.get('created_at')
                break

        query=(
            db.table('pricing_publication_actions')
            .select('date,old_price,target_price,old_min_stay,target_min_stay,reason_codes,payload,status,created_at')
            .eq('property_id',p['id'])
            .gte('created_at',v['created_at'])
            .order('created_at')
            .limit(5000)
        )
        if next_created_at:
            query=query.lt('created_at',next_created_at)
        candidates=query.execute().data or []

        actions=[]
        for action in candidates:
            embedded_version=payload_calendar_version_id(action.get('payload'))
            if embedded_version and embedded_version!=str(v['id']):
                continue
            actions.append(action)

        changes=[a for a in actions if a.get('old_price') is not None and a.get('target_price') is not None and float(a['old_price'])!=float(a['target_price'])]
        min_changes=[a for a in actions if a.get('old_min_stay') is not None and a.get('target_min_stay') is not None and a['old_min_stay']!=a['target_min_stay']]
        if changes:
            config=configurations.get(str(v.get('configuration_version_id'))) or {}
            created_by=text(config.get('created_by'))
            trigger=('owner_configuration' if created_by.startswith('owner:')
                     else 'admin_configuration' if created_by == 'admin'
                     else 'automatic_pricing')
            deltas=[float(a['target_price'])-float(a['old_price']) for a in changes]
            pcts=[100*d/float(a['old_price']) for a,d in zip(changes,deltas) if float(a['old_price'])]
            temporal=sum(1 for a in changes if 'time_curve' in (a.get('reason_codes') or []))
            avg_pct=sum(pcts)/len(pcts) if pcts else 0
            direction='réduit' if avg_pct<0 else 'augmenté'
            n+=insert(db,{'owner_id':p['owner_id'],'property_id':p['id'],'occurred_at':v['created_at'],'category':'pricing','decision_type':'pricing_session','title':'Prix recalculés','summary':f"{p['name']} · {len(changes)} date(s) · moyenne {avg_pct:+.1f}%",'what_happened':f"{len(changes)} prix ont changé, avec une variation moyenne de {avg_pct:+.1f}%.",'why':f"Les règles de saison, de marché et de proximité de l’arrivée ont été réévaluées. {temporal} changement(s) incluent la courbe temporelle.",'action_taken':f"Pilotys a {direction} les prix concernés et préparé leur mise en ligne.",'event_key':f"pricing:session:{v['id']}",'pricing_calendar_version_id':v['id'],'related_object_type':'pricing_calendar_version','related_object_id':v['id'],'metadata':{'changed_dates':len(changes),'average_change_pct':round(avg_pct,2),'average_change_eur':round(sum(deltas)/len(deltas),2),'largest_increase_eur':round(max(deltas),2),'largest_decrease_eur':round(min(deltas),2),'temporal_change_count':temporal,'min_stay_change_count':len(min_changes),'dates':[a['date'] for a in changes[:100]],'trigger':trigger,'created_by':created_by or None,'change_summary':config.get('change_summary'),'configuration_version_id':v.get('configuration_version_id'),'rolled_back_from_version_id':config.get('rolled_back_from_version_id')}})
        if min_changes:
            n+=insert(db,{'owner_id':p['owner_id'],'property_id':p['id'],'occurred_at':v['created_at'],'category':'pricing','decision_type':'minimum_stay_session','title':'Séjours minimums ajustés','summary':f"{p['name']} · {len(min_changes)} date(s)",'what_happened':f"Le séjour minimum a changé sur {len(min_changes)} date(s).",'why':'Pilotys a réévalué la forme des disponibilités et les nuits isolées.','action_taken':'Les changements ont été regroupés en une seule décision.','event_key':f"pricing:minstay:{v['id']}",'pricing_calendar_version_id':v['id'],'related_object_type':'pricing_calendar_version','related_object_id':v['id'],'metadata':{'change_count':len(min_changes),'dates':[a['date'] for a in min_changes[:100]]}})
    return n

def sync_decisions(lookback_days:int=7):
    db=get_supabase_client(); since=(datetime.now(timezone.utc)-timedelta(days=lookback_days)).isoformat(); props=property_map(db)
    result={'reservations':sync_reservations(db,props,since),'cleaning':sync_cleaning(db,props,since),'pricing':sync_pricing(db,props,since)}
    result['total']=sum(result.values()); return result
