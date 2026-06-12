-- supabase/dev_grants_service_role.sql

grant usage on schema public to service_role;

grant select, insert, update, delete
on all tables in schema public
to service_role;

grant usage, select
on all sequences in schema public
to service_role;

alter default privileges in schema public
grant select, insert, update, delete
on tables to service_role;

alter default privileges in schema public
grant usage, select
on sequences to service_role;


alter table cleaning_requests
add column if not exists public_token text unique;

alter table cleaning_requests
add column if not exists public_token_expires_at timestamptz;