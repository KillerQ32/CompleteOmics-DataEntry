drop view if exists public.admin_sample_directory;
drop view if exists public.sample_search;

alter table public.samples
  drop constraint if exists samples_status_rejected_check,
  alter column status drop default;

create type public.sample_status_next as enum (
  'submitted',
  'mailed',
  'accepted',
  'rejected'
);

alter table public.samples
  alter column status type public.sample_status_next
  using (
    case status::text
      when 'draft' then 'submitted'
      when 'submitted' then 'submitted'
      when 'mailed' then 'mailed'
      when 'received' then 'accepted'
      when 'ready_for_review' then 'accepted'
      when 'awaiting_documentation' then 'accepted'
      when 'rejected' then 'rejected'
      else 'submitted'
    end
  )::public.sample_status_next;

drop type public.sample_status;
alter type public.sample_status_next rename to sample_status;

update public.samples
set status = 'rejected'
where rejected = true
  and status <> 'rejected';

alter table public.samples
  alter column status set default 'submitted'::public.sample_status;

alter table public.samples
  add constraint samples_status_rejected_check
  check (status <> 'rejected' or rejected = true);

create view public.sample_search
with (security_invoker = true) as
select
  s.id,
  s.sample_number,
  s.status,
  s.rejected,
  s.collected_at,
  s.received_at,
  p.first_name,
  p.last_name,
  p.date_of_birth,
  c.name as company_name,
  fp.package_id,
  p.first_name || ' ' || p.last_name as patient_full_name
from public.samples s
join public.patients p on p.id = s.patient_id
join public.companies c on c.id = s.company_id
left join public.fedex_packages fp on fp.id = s.fedex_package_id;

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

grant select on public.sample_search to authenticated, service_role;
grant select on public.admin_sample_directory to authenticated, service_role;
