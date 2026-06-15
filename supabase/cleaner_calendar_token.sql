alter table public.cleaners
    add column if not exists public_token text;

update public.cleaners
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table public.cleaners
    alter column public_token set default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists cleaners_public_token_idx
on public.cleaners(public_token);

notify pgrst, 'reload schema';
