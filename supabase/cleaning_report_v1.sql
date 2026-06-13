create table if not exists public.cleaning_checklist_templates (
    id uuid primary key default gen_random_uuid(),
    property_id uuid references public.properties(id) on delete cascade,
    cleaning_profile_id uuid references public.property_cleaning_profiles(id) on delete set null,

    name text not null,
    version integer not null default 1,
    estimated_minutes integer,
    active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (property_id, cleaning_profile_id, version)
);

create table if not exists public.cleaning_checklist_sections (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.cleaning_checklist_templates(id) on delete cascade,

    section_key text not null,
    title text not null,
    high_level_check_label text not null,
    detail_items jsonb not null default '[]'::jsonb,

    order_index integer not null default 0,
    required boolean not null default true,

    -- none | optional | required | problem_only
    photo_requirement text not null default 'optional',

    created_at timestamptz not null default now(),

    unique (template_id, section_key)
);

create table if not exists public.property_reference_photos (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    checklist_section_id uuid references public.cleaning_checklist_sections(id) on delete set null,

    section_key text,
    storage_bucket text not null,
    storage_path text not null,
    caption text,
    order_index integer not null default 0,
    active boolean not null default true,

    created_at timestamptz not null default now()
);

create table if not exists public.cleaning_reports (
    id uuid primary key default gen_random_uuid(),
    cleaning_request_id uuid not null unique references public.cleaning_requests(id) on delete cascade,

    checklist_template_id uuid references public.cleaning_checklist_templates(id) on delete set null,
    checklist_version integer,
    checklist_snapshot jsonb not null default '{}'::jsonb,

    status text not null default 'in_progress',
    started_at timestamptz not null default now(),
    submitted_at timestamptz,

    ready_for_guests boolean not null default false,

    damage_found boolean not null default false,
    damage_notes text,

    missing_items boolean not null default false,
    missing_items_notes text,

    guest_left_items boolean not null default false,
    guest_left_items_notes text,

    linen_problem boolean not null default false,
    linen_notes text,

    consumables_problem boolean not null default false,
    consumables_notes text,

    general_notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cleaning_report_section_checks (
    id uuid primary key default gen_random_uuid(),
    cleaning_report_id uuid not null references public.cleaning_reports(id) on delete cascade,

    section_key text not null,
    title text not null,
    high_level_check_label text not null,
    detail_items_snapshot jsonb not null default '[]'::jsonb,

    details_viewed_at timestamptz,
    checked boolean not null default false,
    checked_at timestamptz,
    notes text,

    created_at timestamptz not null default now(),

    unique (cleaning_report_id, section_key)
);

create table if not exists public.cleaning_report_photos (
    id uuid primary key default gen_random_uuid(),
    cleaning_report_id uuid not null references public.cleaning_reports(id) on delete cascade,
    cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,

    section_key text,
    photo_type text not null default 'proof', -- proof | problem | other

    storage_bucket text not null,
    storage_path text not null,
    original_filename text,
    content_type text,
    size_bytes bigint,
    caption text,

    uploaded_at timestamptz not null default now()
);

create table if not exists public.cleaning_outbound_messages (
    id uuid primary key default gen_random_uuid(),
    cleaning_request_id uuid not null references public.cleaning_requests(id) on delete cascade,

    channel text not null default 'whatsapp',
    message_type text not null,
    recipient_name text,
    recipient_phone text,
    body text not null,

    status text not null default 'drafted', -- drafted | sent | failed
    provider text,
    provider_message_id text,

    created_at timestamptz not null default now(),
    sent_at timestamptz,
    error text
);

insert into storage.buckets (id, name, public)
values ('cleaning-report-photos', 'cleaning-report-photos', false)
on conflict (id) do nothing;

grant select, insert, update, delete on public.cleaning_checklist_templates to service_role;
grant select, insert, update, delete on public.cleaning_checklist_sections to service_role;
grant select, insert, update, delete on public.property_reference_photos to service_role;
grant select, insert, update, delete on public.cleaning_reports to service_role;
grant select, insert, update, delete on public.cleaning_report_section_checks to service_role;
grant select, insert, update, delete on public.cleaning_report_photos to service_role;
grant select, insert, update, delete on public.cleaning_outbound_messages to service_role;