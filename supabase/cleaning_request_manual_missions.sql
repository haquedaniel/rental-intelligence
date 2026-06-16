alter table public.cleaning_requests
    alter column reservation_id drop not null;

alter table public.cleaning_requests
    add column if not exists mission_origin text not null default 'turnover',
    add column if not exists service_type text not null default 'standard_cleaning',
    add column if not exists title text,
    add column if not exists completion_deadline_at timestamptz,
    add column if not exists admin_notes text;

notify pgrst, 'reload schema';
