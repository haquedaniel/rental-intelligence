create table if not exists public.cleaning_reminder_rules (
  id uuid primary key default gen_random_uuid(),

  rule_key text not null unique,
  label text not null,
  enabled boolean not null default true,

  trigger_event text not null default 'accepted_cleaning',

  -- minutes_before: scheduled_start_at - minutes_before
  -- day_of_at_time: mission day at local_time
  timing_type text not null check (timing_type in ('minutes_before', 'day_of_at_time')),
  minutes_before integer,
  local_time time,

  channel text not null default 'sms',
  provider text not null default 'twilio',

  -- If the script was down, avoid sending very stale reminders.
  grace_minutes integer not null default 180,

  message_template text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cleaning_reminder_rules (
  rule_key,
  label,
  enabled,
  trigger_event,
  timing_type,
  minutes_before,
  local_time,
  grace_minutes,
  message_template
)
values
  (
    'accepted_j_minus_7',
    'Rappel J-7',
    true,
    'accepted_cleaning',
    'minutes_before',
    10080,
    null,
    1440,
    'Bonjour {cleaner_first_name} 👋

Petit rappel pour la mission acceptée prévue la semaine prochaine.

🏠 {property_name}
📅 {scheduled_text}

Détail mission :
{mission_link}

Merci !'
  ),
  (
    'accepted_j_minus_1',
    'Rappel J-1',
    true,
    'accepted_cleaning',
    'minutes_before',
    1440,
    null,
    360,
    'Bonjour {cleaner_first_name} 👋

Petit rappel pour la mission ménage acceptée demain.

🏠 {property_name}
📅 {scheduled_text}

Détail mission :
{mission_link}

Merci !'
  ),
  (
    'accepted_morning_of',
    'Rappel matin même',
    false,
    'accepted_cleaning',
    'day_of_at_time',
    null,
    '09:00',
    180,
    'Bonjour {cleaner_first_name} 👋

Rappel : mission ménage prévue aujourd’hui.

🏠 {property_name}
📅 {scheduled_text}

Détail mission :
{mission_link}

Merci !'
  ),
  (
    'accepted_two_hours_before',
    'Rappel 2h avant',
    false,
    'accepted_cleaning',
    'minutes_before',
    120,
    null,
    60,
    'Bonjour {cleaner_first_name} 👋

Rappel : mission ménage bientôt prévue.

🏠 {property_name}
📅 {scheduled_text}

Détail mission :
{mission_link}

Merci !'
  )
on conflict (rule_key) do update
set
  label = excluded.label,
  trigger_event = excluded.trigger_event,
  timing_type = excluded.timing_type,
  minutes_before = excluded.minutes_before,
  local_time = excluded.local_time,
  grace_minutes = excluded.grace_minutes,
  message_template = excluded.message_template,
  updated_at = now();

notify pgrst, 'reload schema';
