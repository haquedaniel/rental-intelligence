-- Archive the property-wide v1 pricing situations. They merged unrelated
-- recalculation sessions and could describe manual configuration saves as
-- autonomous Pilotys decisions. Raw ops_decisions remain untouched.
update public.ops_situations
set
  status = 'dismissed',
  resolved_at = coalesce(resolved_at, now()),
  updated_at = now()
where situation_key like 'pricing:%:latest';
