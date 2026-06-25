-- Freeze the checklist template used by each cleaning request.
-- This prevents future checklist/profile edits from changing accepted missions.

alter table public.cleaning_requests
  add column if not exists checklist_template_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cleaning_requests_checklist_template_id_fkey'
      and conrelid = 'public.cleaning_requests'::regclass
  ) then
    alter table public.cleaning_requests
      add constraint cleaning_requests_checklist_template_id_fkey
      foreign key (checklist_template_id)
      references public.cleaning_checklist_templates(id)
      on delete set null;
  end if;
end $$;

create index if not exists cleaning_requests_checklist_template_id_idx
  on public.cleaning_requests(checklist_template_id);

create or replace function public.set_cleaning_request_checklist_template()
returns trigger
language plpgsql
as $$
begin
  -- If the property/profile changes and the caller did not explicitly set a
  -- different template, recompute the snapshot.
  if tg_op = 'UPDATE'
     and (
       new.property_id is distinct from old.property_id
       or new.cleaning_profile_id is distinct from old.cleaning_profile_id
     )
     and new.checklist_template_id is not distinct from old.checklist_template_id
  then
    new.checklist_template_id := null;
  end if;

  -- Preserve an explicit snapshot.
  if new.checklist_template_id is not null then
    return new;
  end if;

  -- Prefer an active template for the selected cleaning profile.
  -- If none exists, fall back only to a default property template.
  -- Do not fall back to another profile's template.
  select t.id
  into new.checklist_template_id
  from public.cleaning_checklist_templates t
  where t.property_id = new.property_id
    and t.active = true
    and (
      t.cleaning_profile_id = new.cleaning_profile_id
      or t.cleaning_profile_id is null
    )
  order by
    case
      when t.cleaning_profile_id = new.cleaning_profile_id then 0
      when t.cleaning_profile_id is null then 1
      else 2
    end,
    coalesce(t.version, 0) desc,
    t.created_at desc nulls last,
    t.id
  limit 1;

  return new;
end
$$;

drop trigger if exists trg_set_cleaning_request_checklist_template
  on public.cleaning_requests;

create trigger trg_set_cleaning_request_checklist_template
before insert or update of property_id, cleaning_profile_id, checklist_template_id
on public.cleaning_requests
for each row
execute function public.set_cleaning_request_checklist_template();

-- One-off repair for Sandrine's overdue mission:
-- economically it is the 5h standard clean, but it was still linked to an old inactive light profile.
update public.cleaning_requests
set
  cleaning_profile_id = '0c74b093-b8ed-46fb-b362-60a0db9f0872',
  checklist_template_id = null
where id = 'e5cdd1f2-6541-4948-be28-6b7512e325dd'
  and property_id = '20000000-0000-0000-0000-000000000001';

-- Backfill existing requests where possible.
update public.cleaning_requests cr
set checklist_template_id = (
  select t.id
  from public.cleaning_checklist_templates t
  where t.property_id = cr.property_id
    and t.active = true
    and (
      t.cleaning_profile_id = cr.cleaning_profile_id
      or t.cleaning_profile_id is null
    )
  order by
    case
      when t.cleaning_profile_id = cr.cleaning_profile_id then 0
      when t.cleaning_profile_id is null then 1
      else 2
    end,
    coalesce(t.version, 0) desc,
    t.created_at desc nulls last,
    t.id
  limit 1
)
where cr.checklist_template_id is null
  and exists (
    select 1
    from public.cleaning_checklist_templates t
    where t.property_id = cr.property_id
      and t.active = true
      and (
        t.cleaning_profile_id = cr.cleaning_profile_id
        or t.cleaning_profile_id is null
      )
  );
