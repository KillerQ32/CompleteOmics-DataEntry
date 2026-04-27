alter table public.user_profiles
  add column if not exists notes text;

drop view if exists public.admin_user_directory;

create or replace view public.admin_user_directory
with (security_invoker = true) as
select
  up.id,
  up.first_name,
  up.last_name,
  up.role,
  up.company_id,
  c.name as company_name,
  up.account_status,
  up.notes,
  up.created_at,
  up.updated_at
from public.user_profiles up
left join public.companies c on c.id = up.company_id;

grant select on public.admin_user_directory to authenticated, service_role;
