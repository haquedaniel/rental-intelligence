create table if not exists public.cleaning_checklist_section_translations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.cleaning_checklist_sections(id) on delete cascade,
  language text not null check (language in ('en', 'ru')),
  title text,
  high_level_check_label text,
  detail_items jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, language)
);

create index if not exists idx_cleaning_checklist_section_translations_section_language
  on public.cleaning_checklist_section_translations(section_id, language);

with english_translations(section_key, title, high_level_check_label, detail_items) as (
  values
    (
      'premieres_taches',
      'First tasks',
      'First tasks done',
      '["Turn off the heaters", "Open all windows to air the property", "Turn off and unplug unused appliances", "Remove rubbish and dirty linen from the property"]'::jsonb
    ),
    (
      'sanitaires',
      'Bathroom / toilet',
      'Bathroom and toilet clean',
      '["Toilet, seat and brush clean", "Sink, shower or bath clean", "Drains emptied", "Glass surfaces clean"]'::jsonb
    ),
    (
      'cuisine',
      'Kitchen',
      'Kitchen clean',
      '["Fridge emptied and clean", "Oven and microwave clean", "Cupboards checked inside and outside", "Worktops clean", "Bin cleaned"]'::jsonb
    ),
    (
      'sols_poussieres',
      'Floors and dust',
      'Floors and surfaces clean',
      '["TV, furniture and shelves dusted", "Cushions shaken and put back", "Obvious marks on windows removed", "Vacuum cleaning done", "Mopping done"]'::jsonb
    ),
    (
      'poussieres_sols',
      'Floors and dust',
      'Floors and surfaces clean',
      '["TV, furniture and shelves dusted", "Sofa cushions shaken", "Obvious marks on windows removed", "Vacuum cleaning done", "Mopping done"]'::jsonb
    ),
    (
      'preparation',
      'Preparation',
      'Property prepared',
      '["Beds made if linen is planned", "Towels in place", "Tea towels in place", "Welcome products restocked", "Furniture put back carefully"]'::jsonb
    ),
    (
      'controle_final',
      'Final check',
      'Property ready',
      '["All windows closed", "Heating turned off", "Lights turned off", "Property aired then closed", "Property ready for guest arrival"]'::jsonb
    )
)
insert into public.cleaning_checklist_section_translations (
  section_id,
  language,
  title,
  high_level_check_label,
  detail_items
)
select
  section.id,
  'en',
  english_translations.title,
  english_translations.high_level_check_label,
  english_translations.detail_items
from public.cleaning_checklist_sections section
join public.cleaning_checklist_templates template
  on template.id = section.template_id
left join public.property_cleaning_profiles profile
  on profile.id = template.cleaning_profile_id
join english_translations
  on english_translations.section_key = section.section_key
where template.active is true
  and section.active is true
  and (
    template.name ilike '%Ménage standard%'
    or template.name ilike '%Menage standard%'
    or coalesce(profile.label, '') ilike '%Ménage standard%'
    or coalesce(profile.label, '') ilike '%Menage standard%'
    or profile.service_type = 'standard_cleaning'
  )
on conflict (section_id, language) do update set
  title = excluded.title,
  high_level_check_label = excluded.high_level_check_label,
  detail_items = excluded.detail_items,
  updated_at = now();

with russian_translations(section_key, title, high_level_check_label, detail_items) as (
  values
    (
      'premieres_taches',
      'Первые задачи',
      'Первые задачи выполнены',
      '["Выключить радиаторы", "Открыть все окна для проветривания", "Выключить и отключить ненужные приборы", "Убрать мусор и грязное бельё из жилья"]'::jsonb
    ),
    (
      'sanitaires',
      'Санузел',
      'Санузел чистый',
      '["Унитаз, сиденье и щётка чистые", "Раковина, душ или ванна чистые", "Сливы очищены", "Стеклянные поверхности чистые"]'::jsonb
    ),
    (
      'cuisine',
      'Кухня',
      'Кухня чистая',
      '["Холодильник пустой и чистый", "Духовка и микроволновка чистые", "Шкафы проверены внутри и снаружи", "Рабочие поверхности чистые", "Мусорное ведро очищено"]'::jsonb
    ),
    (
      'sols_poussieres',
      'Пыль и полы',
      'Полы и поверхности чистые',
      '["Телевизор, мебель и полки очищены от пыли", "Подушки встряхнуты и поставлены на место", "Заметные следы на окнах удалены", "Пропылесосить", "Помыть пол"]'::jsonb
    ),
    (
      'poussieres_sols',
      'Пыль и полы',
      'Полы и поверхности чистые',
      '["Телевизор, мебель и полки очищены от пыли", "Подушки дивана встряхнуты", "Заметные следы на окнах удалены", "Пропылесосить", "Помыть пол"]'::jsonb
    ),
    (
      'preparation',
      'Подготовка',
      'Жильё подготовлено',
      '["Кровати заправлены, если бельё предусмотрено", "Полотенца на месте", "Кухонные полотенца на месте", "Приветственные продукты пополнены", "Мебель аккуратно поставлена на место"]'::jsonb
    ),
    (
      'controle_final',
      'Финальная проверка',
      'Жильё готово',
      '["Все окна закрыты", "Отопление выключено", "Свет выключен", "Жильё проветрено и закрыто", "Жильё готово к приезду гостей"]'::jsonb
    )
)
insert into public.cleaning_checklist_section_translations (
  section_id,
  language,
  title,
  high_level_check_label,
  detail_items
)
select
  section.id,
  'ru',
  russian_translations.title,
  russian_translations.high_level_check_label,
  russian_translations.detail_items
from public.cleaning_checklist_sections section
join public.cleaning_checklist_templates template
  on template.id = section.template_id
left join public.property_cleaning_profiles profile
  on profile.id = template.cleaning_profile_id
join russian_translations
  on russian_translations.section_key = section.section_key
where template.active is true
  and section.active is true
  and (
    template.name ilike '%Ménage standard%'
    or template.name ilike '%Menage standard%'
    or coalesce(profile.label, '') ilike '%Ménage standard%'
    or coalesce(profile.label, '') ilike '%Menage standard%'
    or profile.service_type = 'standard_cleaning'
  )
on conflict (section_id, language) do update set
  title = excluded.title,
  high_level_check_label = excluded.high_level_check_label,
  detail_items = excluded.detail_items,
  updated_at = now();
