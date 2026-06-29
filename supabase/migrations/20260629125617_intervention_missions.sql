alter table public.cleaning_requests
  add column if not exists mission_type text not null default 'cleaning',
  add column if not exists mission_category text,
  add column if not exists mission_description text,
  add column if not exists proof_photo_requirement text not null default 'optional',
  add column if not exists estimated_hours numeric,
  add column if not exists actual_hours numeric,
  add column if not exists hourly_rate_eur_snapshot numeric,
  add column if not exists material_expenses_total_eur numeric not null default 0,
  add column if not exists allow_actual_hours_edit boolean not null default false,
  add column if not exists allow_material_expenses boolean not null default false,
  add column if not exists no_backup_escalation boolean not null default false,
  add column if not exists occupied_warning_acknowledged_at timestamptz,
  add column if not exists intervention_refusal_reason text;

alter table public.cleaning_requests
  drop constraint if exists cleaning_requests_mission_type_check;

alter table public.cleaning_requests
  add constraint cleaning_requests_mission_type_check
  check (mission_type in ('cleaning', 'intervention'));

alter table public.cleaning_requests
  drop constraint if exists cleaning_requests_proof_photo_requirement_check;

alter table public.cleaning_requests
  add constraint cleaning_requests_proof_photo_requirement_check
  check (proof_photo_requirement in ('none', 'optional', 'required'));

create table if not exists public.intervention_reports (
  id uuid primary key default gen_random_uuid(),
  cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
  status text not null default 'completed',
  work_summary text,
  issue_notes text,
  actual_hours numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cleaning_request_id)
);

create table if not exists public.intervention_report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.intervention_reports(id) on delete cascade,
  cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
  bucket text not null,
  path text not null,
  kind text not null default 'proof',
  created_at timestamptz not null default now()
);

create table if not exists public.intervention_expenses (
  id uuid primary key default gen_random_uuid(),
  cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,
  report_id uuid references public.intervention_reports(id) on delete cascade,
  label text not null,
  amount_eur numeric not null default 0,
  receipt_bucket text,
  receipt_path text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intervention-reference-photos',
  'intervention-reference-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intervention-report-photos',
  'intervention-report-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
