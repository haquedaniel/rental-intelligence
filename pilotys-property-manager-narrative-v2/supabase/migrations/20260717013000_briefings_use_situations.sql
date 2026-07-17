alter table public.ops_briefings
  add column if not exists situation_ids uuid[] not null default '{}';
