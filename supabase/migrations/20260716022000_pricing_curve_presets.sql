-- Human-friendly optimisation curve presets.
-- JSON remains authoritative; these columns preserve the UI choice and make it explainable.
alter table public.pricing_property_settings
  add column if not exists optimisation_preset text not null default 'progressive',
  add column if not exists optimisation_horizon_days integer not null default 120,
  add column if not exists optimisation_max_discount_pct numeric(6,2) not null default 30;

alter table public.pricing_seasons
  add column if not exists optimisation_mode text not null default 'inherit',
  add column if not exists optimisation_preset text,
  add column if not exists optimisation_horizon_days integer,
  add column if not exists optimisation_max_discount_pct numeric(6,2);

comment on column public.pricing_seasons.optimisation_mode is
  'inherit = use property curve, custom = use season curve, none = no temporal discount';
