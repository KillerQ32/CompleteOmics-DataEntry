alter table public.samples
  add column if not exists ordering_provider_name text;

drop view if exists public.admin_sample_directory;

create view public.admin_sample_directory
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
  s.icd10_codes,
  s.ordering_provider_name,
  s.npi_number,
  s.created_at,
  s.updated_at
from public.samples s
join public.companies c on c.id = s.company_id
join public.patients p on p.id = s.patient_id
left join public.fedex_packages fp on fp.id = s.fedex_package_id;

grant select on public.admin_sample_directory to authenticated, service_role;
