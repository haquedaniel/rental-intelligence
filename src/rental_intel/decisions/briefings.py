from __future__ import annotations
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from rental_intel.cleaning.db import get_supabase_client

def due(pref, now):
    if not pref.get('enabled'): return False
    tz=ZoneInfo(pref.get('timezone') or 'Europe/Paris'); local=now.astimezone(tz); last=pref.get('last_briefing_at')
    lastdt=datetime.fromisoformat(last.replace('Z','+00:00')).astimezone(tz) if last else None
    freq=pref.get('frequency') or 'morning'; hour=int(pref.get('delivery_hour') or 8)
    if freq=='immediate': return True
    if local.hour < hour: return False
    if freq in ('morning','evening','daily'): return not lastdt or lastdt.date()<local.date()
    return local.weekday()==int(pref.get('weekly_day') or 1) and (not lastdt or (local.date()-lastdt.date()).days>=6)

def allowed(d,p):
    t=d.get('decision_type','')
    mapping={'reservation_created':'include_reservations','reservation_modified':'include_reservations','reservation_cancelled':'include_reservations','cleaning_completed':'include_cleaning_completed','cleaner_accepted':'include_cleaner_accepted','cleaner_refused':'include_cleaner_refused','cleaning_rescheduled':'include_cleaning_rescheduled','pricing_session':'include_pricing','minimum_stay_session':'include_min_stay'}
    if not p.get(mapping.get(t,''),True): return False
    ids=p.get('included_property_ids') or []
    if ids and d.get('property_id') not in ids: return False
    if t=='pricing_session':
        m=d.get('metadata') or {}; typ=p.get('pricing_threshold_type') or 'pct'; value=float(p.get('pricing_threshold_value') or 0)
        metric=abs(float(m.get('average_change_pct') or 0)) if typ=='pct' else abs(float(m.get('average_change_eur') or 0))
        if metric<value and not (p.get('include_temporal_daily') and int(m.get('temporal_change_count') or 0)>0): return False
    return True

def render(owner, decisions):
    props={}
    for d in decisions: props.setdefault(d.get('property_id'),[]).append(d)
    lines=[f"Pilotys — {owner.get('display_name') or owner.get('name')}"]
    reservations=[d for d in decisions if d['category']=='reservation']; cleaning=[d for d in decisions if d['category']=='cleaning']; pricing=[d for d in decisions if d['category']=='pricing']
    if reservations:
        counts={};
        for d in reservations: counts[d['decision_type']]=counts.get(d['decision_type'],0)+1
        bits=[]
        if counts.get('reservation_created'): bits.append(f"{counts['reservation_created']} nouvelle(s) réservation(s)")
        if counts.get('reservation_modified'): bits.append(f"{counts['reservation_modified']} modifiée(s)")
        if counts.get('reservation_cancelled'): bits.append(f"{counts['reservation_cancelled']} annulée(s)")
        lines.append('• Réservations : '+', '.join(bits))
    for d in pricing:
        if d['decision_type']=='pricing_session':
            m=d.get('metadata') or {}; lines.append(f"• Tarification : {m.get('changed_dates',0)} date(s) ajustée(s), moyenne {float(m.get('average_change_pct') or 0):+.1f}% ({d.get('summary','')})")
        else: lines.append('• '+d['summary'])
    completed=sum(1 for d in cleaning if d['decision_type']=='cleaning_completed'); accepted=sum(1 for d in cleaning if d['decision_type']=='cleaner_accepted'); refused=sum(1 for d in cleaning if d['decision_type']=='cleaner_refused'); resched=sum(1 for d in cleaning if d['decision_type']=='cleaning_rescheduled')
    bits=[]
    if completed: bits.append(f"{completed} mission(s) terminée(s)")
    if accepted: bits.append(f"{accepted} acceptée(s)")
    if refused: bits.append(f"{refused} refusée(s)")
    if resched: bits.append(f"{resched} replanifiée(s)")
    if bits: lines.append('• Opérations : '+', '.join(bits))
    action=any(d.get('requires_owner_action') for d in decisions)
    lines.append('Action requise : consultez Pilotys.' if action else 'Aucune action requise.')
    return '\n'.join(lines)

def generate_due_briefings(force_owner_id=None):
    db=get_supabase_client(); now=datetime.now(timezone.utc)
    q=db.table('ops_briefing_preferences').select('*').eq('enabled',True)
    if force_owner_id:q=q.eq('owner_id',force_owner_id)
    prefs=q.execute().data or []; result=[]
    for p in prefs:
        if not force_owner_id and not due(p,now): continue
        last=p.get('last_briefing_at') or (now-timedelta(days=7 if p.get('frequency')=='weekly' else 1)).isoformat()
        ds=db.table('ops_decisions').select('*').eq('owner_id',p['owner_id']).gt('occurred_at',last).lte('occurred_at',now.isoformat()).order('occurred_at').execute().data or []
        ds=[d for d in ds if allowed(d,p)]
        if not ds and p.get('frequency')=='immediate': continue
        owner=db.table('owners').select('id,name,display_name').eq('id',p['owner_id']).single().execute().data
        body=render(owner,ds) if ds else f"Pilotys — {owner.get('display_name') or owner.get('name')}\nAucun événement notable depuis le dernier briefing.\nAucune action requise."
        b=db.table('ops_briefings').insert({'owner_id':p['owner_id'],'period_start':last,'period_end':now.isoformat(),'frequency':p.get('frequency'),'title':'Briefing Pilotys','body':body,'decision_ids':[d['id'] for d in ds],'decision_count':len(ds),'requires_owner_action':any(d.get('requires_owner_action') for d in ds),'status':'queued'}).execute().data[0]
        recipients=[x for x in (p.get('recipient_1_phone'),p.get('recipient_2_phone')) if x]
        for phone in dict.fromkeys(recipients):
            event_key=f"owner_briefing:{b['id']}:{phone}"
            msg=db.table('outbound_messages').insert({'owner_id':p['owner_id'],'channel':'sms','message_type':'owner_briefing','recipient_phone':phone,'body':body,'status':'pending','event_key':event_key}).execute().data[0]
            db.table('ops_briefing_deliveries').insert({'briefing_id':b['id'],'owner_id':p['owner_id'],'recipient':phone,'outbound_message_id':msg['id'],'status':'queued'}).execute()
        db.table('ops_briefing_preferences').update({'last_briefing_at':now.isoformat(),'updated_at':now.isoformat()}).eq('owner_id',p['owner_id']).execute()
        result.append({'owner_id':p['owner_id'],'briefing_id':b['id'],'decisions':len(ds),'recipients':len(recipients)})
    return result
