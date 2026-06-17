-- 1) Bring schema to the app's final expected shape

alter table public.property_cleaning_profiles
  add column if not exists service_type text not null default 'standard_cleaning',
  add column if not exists description text,
  add column if not exists active boolean not null default true,
  add column if not exists default_linen_required boolean not null default true,
  add column if not exists default_laundry_required boolean not null default true,
  add column if not exists sort_order integer not null default 100;

alter table public.cleaning_checklist_templates
  add column if not exists cleaning_profile_id uuid references public.property_cleaning_profiles(id);

alter table public.cleaning_checklist_sections
  add column if not exists high_level_check_label text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists photo_requirement text not null default 'none',
  add column if not exists detail_items jsonb not null default '[]'::jsonb,
  add column if not exists required boolean not null default true,
  add column if not exists visible_to_cleaner boolean not null default true,
  add column if not exists active boolean not null default true;

update public.cleaning_checklist_sections
set high_level_check_label = title
where high_level_check_label is null;


-- 2) Optional: make sure each property has at least one standard work type

insert into public.property_cleaning_profiles (
  property_id,
  code,
  label,
  service_type,
  estimated_hours,
  default_linen_required,
  default_laundry_required,
  active,
  sort_order
)
select
  p.id,
  'standard_cleaning',
  'Ménage standard',
  'standard_cleaning',
  2,
  true,
  true,
  true,
  20
from public.properties p
where not exists (
  select 1
  from public.property_cleaning_profiles cp
  where cp.property_id = p.id
    and cp.service_type = 'standard_cleaning'
    and cp.active = true
);


-- 3) Wipe only checklist content.
-- This also removes old test section checks if any reports were already submitted.

do $$
begin
  if to_regclass('public.cleaning_report_section_checks') is not null then
    execute 'delete from public.cleaning_report_section_checks';
  end if;
end $$;

delete from public.cleaning_checklist_sections;
delete from public.cleaning_checklist_templates;


-- 4) Recreate one clean checklist per active work type / mission profile

do $$
declare
  profile record;
  template_id uuid;
  estimated_minutes_int integer;
begin
  for profile in
    select *
    from public.property_cleaning_profiles
    where active = true
    order by property_id, sort_order, label
  loop
    estimated_minutes_int :=
      greatest(30, round(coalesce(profile.estimated_hours, 2) * 60)::integer);

    insert into public.cleaning_checklist_templates (
      property_id,
      cleaning_profile_id,
      name,
      estimated_minutes,
      active
    )
    values (
      profile.property_id,
      profile.id,
      coalesce(profile.label, 'Checklist'),
      estimated_minutes_int,
      true
    )
    returning id into template_id;

    if profile.service_type = 'garden_lawn' then
      insert into public.cleaning_checklist_sections (
        template_id,
        section_key,
        title,
        high_level_check_label,
        sort_order,
        photo_requirement,
        detail_items,
        required,
        visible_to_cleaner,
        active
      )
      values
      (
        template_id,
        'tonte_jardin',
        'Tonte du jardin',
        'Jardin tondu',
        10,
        'optional',
        '[
          "Tondre les zones prévues",
          "Débroussailler légèrement si nécessaire",
          "Ramasser les déchets visibles",
          "Ranger ou signaler le matériel utilisé"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'controle_final_exterieur',
        'Contrôle final extérieur',
        'Extérieur propre et présentable',
        20,
        'optional',
        '[
          "Vérifier que les accès sont dégagés",
          "Vérifier que rien ne gêne les voyageurs",
          "Signaler tout problème visible",
          "Prendre une photo si utile"
        ]'::jsonb,
        true,
        true,
        true
      );

    else
      insert into public.cleaning_checklist_sections (
        template_id,
        section_key,
        title,
        high_level_check_label,
        sort_order,
        photo_requirement,
        detail_items,
        required,
        visible_to_cleaner,
        active
      )
      values
      (
        template_id,
        'premieres_taches',
        'Premières tâches',
        'Premières tâches effectuées',
        10,
        'none',
        '[
          "Couper les radiateurs",
          "Ouvrir toutes les fenêtres pour aérer",
          "Couper et débrancher tous les appareils inutiles",
          "Vider le logement des poubelles et du linge sale"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'sanitaires',
        'Sanitaires',
        'Sanitaires propres',
        20,
        'none',
        '[
          "WC, lunette et brosse propres",
          "Lavabo, douche ou baignoire propres",
          "Bondes d’évacuation vidées",
          "Surfaces vitrées propres"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'cuisine',
        'Cuisine',
        'Cuisine propre',
        30,
        'none',
        '[
          "Frigo vidé et propre",
          "Four et micro-ondes propres",
          "Placards intérieurs et extérieurs vérifiés",
          "Plans de travail propres",
          "Poubelle nettoyée"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'poussieres_sols',
        'Poussières et sols',
        'Sols et surfaces propres',
        40,
        'none',
        '[
          "TV, meubles et étagères dépoussiérés",
          "Coussins du canapé secoués",
          "Traces grossières sur les vitres retirées",
          "Aspirateur passé",
          "Serpillière passée"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'preparation',
        'Préparation',
        'Logement préparé',
        50,
        'none',
        '[
          "Réapprovisionner en linge si prévu",
          "Faire les lits si prévu",
          "Mettre les serviettes de toilette",
          "Mettre deux torchons",
          "Réapprovisionner les produits d’accueil",
          "Positionner avec soin le mobilier"
        ]'::jsonb,
        true,
        true,
        true
      ),
      (
        template_id,
        'controle_final',
        'Contrôle final',
        'Logement prêt',
        60,
        'optional',
        '[
          "Toutes les fenêtres fermées",
          "Chauffage coupé",
          "Lumières éteintes",
          "Logement aéré puis refermé",
          "Logement prêt pour l’arrivée des voyageurs"
        ]'::jsonb,
        true,
        true,
        true
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';