alter table public.cleaners
  add column if not exists app_invited_at timestamptz,
  add column if not exists app_first_opened_at timestamptz,
  add column if not exists app_onboarded_at timestamptz;
