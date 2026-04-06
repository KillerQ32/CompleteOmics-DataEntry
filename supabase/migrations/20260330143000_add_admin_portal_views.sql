create or replace view public.admin_user_directory
with (security_invoker = true) as
select
  up.id,
  up.first_name,
  up.last_name,
  up.role,
  up.company_id,
  c.name as company_name,
  up.created_at,
  up.updated_at
from public.user_profiles up
left join public.companies c on c.id = up.company_id;

create or replace view public.admin_sample_directory
with (security_invoker = true) as
select
  s.id,
  s.sample_number,
  s.company_id,
  c.name as company_name,
  s.patient_id,
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  p.date_of_birth,
  s.fedex_package_id,
  fp.package_id,
  s.status,
  s.rejected,
  s.rejection_reason,
  s.rejected_at,
  s.received_at,
  s.collected_at,
  s.collected_by,
  s.sex,
  s.hart_cadhs,
  s.hart_cve,
  s.missing_info,
  s.created_at,
  s.updated_at
from public.samples s
join public.companies c on c.id = s.company_id
join public.patients p on p.id = s.patient_id
left join public.fedex_packages fp on fp.id = s.fedex_package_id;

grant select on public.admin_user_directory to authenticated, service_role;
grant select on public.admin_sample_directory to authenticated, service_role;
