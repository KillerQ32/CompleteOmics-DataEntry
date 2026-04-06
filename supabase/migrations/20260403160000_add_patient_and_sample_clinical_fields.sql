alter table public.patients
  drop column if exists weight_kg,
  drop column if exists height_cm,
  add column if not exists weight_lbs numeric(6, 2),
  add column if not exists height_inches numeric(6, 2),
  add column if not exists angioplasty_or_stent boolean not null default false,
  add column if not exists cabg boolean not null default false;

alter table public.samples
  add column if not exists icd10_codes text[] not null default '{}',
  add column if not exists npi_number text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'samples'
      and constraint_name = 'samples_icd10_codes_limit'
  ) then
    alter table public.samples
      add constraint samples_icd10_codes_limit
      check (cardinality(icd10_codes) <= 5);
  end if;
end
$$;

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
  s.npi_number,
  s.created_at,
  s.updated_at
from public.samples s
join public.companies c on c.id = s.company_id
join public.patients p on p.id = s.patient_id
left join public.fedex_packages fp on fp.id = s.fedex_package_id;

grant select on public.admin_sample_directory to authenticated, service_role;
