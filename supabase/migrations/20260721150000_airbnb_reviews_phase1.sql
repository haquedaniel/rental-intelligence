create table if not exists public.guest_reviews (
    id uuid primary key default gen_random_uuid(),
    channel text not null default 'airbnb',
    source_system text not null default 'beds24',
    external_review_id text not null,
    external_booking_id text,
    source_property_id text,
    source_room_id text,
    source_listing_id text,
    property_id uuid references public.properties(id) on delete set null,
    reservation_id uuid references public.reservations(id) on delete set null,
    review_date timestamptz,
    guest_name text,
    overall_rating numeric,
    cleanliness_rating numeric,
    accuracy_rating numeric,
    checkin_rating numeric,
    communication_rating numeric,
    location_rating numeric,
    value_rating numeric,
    category_ratings jsonb not null default '{}'::jsonb,
    review_text text,
    host_reply text,
    match_status text not null default 'unmatched'
      check (match_status in ('direct_booking_id','strong_date_guest','ambiguous','unmatched')),
    match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
    match_notes text,
    raw_payload jsonb not null default '{}'::jsonb,
    source_modified_at timestamptz,
    imported_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_system, channel, external_review_id)
);

create index if not exists guest_reviews_property_date_idx
  on public.guest_reviews(property_id, review_date desc);
create index if not exists guest_reviews_reservation_idx
  on public.guest_reviews(reservation_id);
create index if not exists guest_reviews_external_booking_idx
  on public.guest_reviews(external_booking_id);
create index if not exists guest_reviews_match_status_idx
  on public.guest_reviews(match_status);

create or replace function public.set_guest_reviews_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guest_reviews_set_updated_at on public.guest_reviews;
create trigger guest_reviews_set_updated_at
before update on public.guest_reviews
for each row execute function public.set_guest_reviews_updated_at();

grant select, insert, update, delete on public.guest_reviews to service_role;

create or replace view public.guest_review_listing_summary as
select
  property_id,
  count(*) filter (where overall_rating is not null) as review_count,
  round(avg(overall_rating)::numeric, 2) as overall_rating,
  round(avg(cleanliness_rating)::numeric, 2) as cleanliness_rating,
  min(review_date) as first_review_at,
  max(review_date) as latest_review_at
from public.guest_reviews
group by property_id;

grant select on public.guest_review_listing_summary to service_role;
notify pgrst, 'reload schema';
