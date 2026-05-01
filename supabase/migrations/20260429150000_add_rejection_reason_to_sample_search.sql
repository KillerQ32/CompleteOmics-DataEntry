drop view if exists public.sample_search;

create or replace view public.sample_search
with (security_invoker = true) as
select
  s.id,
  s.sample_number,
  s.status,
  s.rejected,
  s.rejection_reason,
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

grant select on public.sample_search to authenticated, service_role;
