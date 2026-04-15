create or replace function public.validate_patient_document_relations()
returns trigger
language plpgsql
as $$
declare
  sample_patient_id uuid;
  sample_company_id uuid;
begin
  if new.patient_id is null or new.sample_id is null then
    raise exception 'Documents must be tied to both a patient and a sample.';
  end if;

  select patient_id, company_id
    into sample_patient_id, sample_company_id
  from public.samples
  where id = new.sample_id;

  if sample_patient_id is distinct from new.patient_id then
    raise exception 'Document sample must match the selected patient.';
  end if;

  if sample_company_id is distinct from new.company_id then
    raise exception 'Document sample must match the selected clinic.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_patient_document_relations_trigger on public.patient_documents;
create trigger validate_patient_document_relations_trigger
before insert or update on public.patient_documents
for each row
execute function public.validate_patient_document_relations();

alter table public.patient_documents
  add constraint patient_documents_patient_sample_required
  check (patient_id is not null and sample_id is not null)
  not valid;

create or replace view public.document_directory
with (security_invoker = true) as
select
  d.id,
  d.company_id,
  c.name as company_name,
  d.patient_id,
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  d.sample_id,
  s.sample_number,
  d.original_filename,
  d.storage_path,
  d.created_at
from public.patient_documents d
join public.companies c on c.id = d.company_id
join public.patients p on p.id = d.patient_id
join public.samples s on s.id = d.sample_id;

grant select on public.document_directory to authenticated, service_role;
