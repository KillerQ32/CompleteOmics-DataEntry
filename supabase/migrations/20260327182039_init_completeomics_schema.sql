create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'customer');
create type public.sample_status as enum (
  'draft',
  'submitted',
  'mailed',
  'received',
  'ready_for_review',
  'awaiting_documentation',
  'rejected'
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  contact_phone text,
  contact_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  role public.app_role not null default 'customer',
  first_name text,
  last_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  weight_kg numeric(6, 2),
  height_cm numeric(6, 2),
  race_ethnicity text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.fedex_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  package_id text not null unique,
  mailed_at timestamptz,
  received_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  sample_number text not null unique,
  company_id uuid not null references public.companies (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  fedex_package_id uuid references public.fedex_packages (id) on delete set null,
  received_at timestamptz,
  collected_at timestamptz,
  collected_by text,
  missing_info text,
  hart_cadhs boolean not null default false,
  hart_cve boolean not null default false,
  sex text,
  status public.sample_status not null default 'draft',
  rejected boolean not null default false,
  rejection_reason text,
  rejected_at timestamptz,
  rejected_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint samples_status_rejected_check check (status <> 'rejected' or rejected = true),
  constraint samples_rejection_consistency check (
    (rejected = false and rejection_reason is null and rejected_at is null and rejected_by is null)
    or rejected = true
  )
);

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  sample_id uuid references public.samples (id) on delete set null,
  storage_bucket text not null default 'patient-documents',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint patient_documents_storage_bucket_check check (storage_bucket = 'patient-documents')
);

create index patients_company_id_idx on public.patients (company_id);
create index fedex_packages_company_id_idx on public.fedex_packages (company_id);
create index samples_company_id_idx on public.samples (company_id);
create index samples_patient_id_idx on public.samples (patient_id);
create index samples_fedex_package_id_idx on public.samples (fedex_package_id);
create index samples_status_idx on public.samples (status);
create index samples_rejected_idx on public.samples (rejected);
create index patient_documents_company_id_idx on public.patient_documents (company_id);
create index patient_documents_patient_id_idx on public.patient_documents (patient_id);
create index user_profiles_company_id_idx on public.user_profiles (company_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select role
  from public.user_profiles
  where id = auth.uid()
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select company_id
  from public.user_profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.validate_sample_relations()
returns trigger
language plpgsql
as $$
declare
  patient_company_id uuid;
  package_company_id uuid;
begin
  select company_id into patient_company_id
  from public.patients
  where id = new.patient_id;

  if patient_company_id is distinct from new.company_id then
    raise exception 'Sample company must match patient company.';
  end if;

  if new.fedex_package_id is not null then
    select company_id into package_company_id
    from public.fedex_packages
    where id = new.fedex_package_id;

    if package_company_id is distinct from new.company_id then
      raise exception 'Sample company must match package company.';
    end if;
  end if;

  if new.rejected and new.status <> 'rejected' then
    new.status := 'rejected';
  end if;

  if new.rejected and new.rejected_at is null then
    new.rejected_at := timezone('utc', now());
  end if;

  if new.rejected and new.rejected_by is null then
    new.rejected_by := auth.uid();
  end if;

  return new;
end;
$$;

create or replace function public.prevent_non_admin_rejection_updates()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.rejected
      or new.status = 'rejected'
      or new.rejection_reason is not null
      or new.rejected_at is not null
      or new.rejected_by is not null then
      raise exception 'Only admin users can set rejection fields.';
    end if;

    return new;
  end if;

  if new.rejected is distinct from old.rejected
    or (new.status is distinct from old.status and (new.status = 'rejected' or old.status = 'rejected'))
    or new.rejection_reason is distinct from old.rejection_reason
    or new.rejected_at is distinct from old.rejected_at
    or new.rejected_by is distinct from old.rejected_by then
    raise exception 'Only admin users can change rejection fields.';
  end if;

  return new;
end;
$$;

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

create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create trigger set_patients_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

create trigger set_fedex_packages_updated_at
before update on public.fedex_packages
for each row
execute function public.set_updated_at();

create trigger set_samples_updated_at
before update on public.samples
for each row
execute function public.set_updated_at();

create trigger validate_sample_relations_trigger
before insert or update on public.samples
for each row
execute function public.validate_sample_relations();

create trigger prevent_non_admin_rejection_updates_trigger
before insert or update on public.samples
for each row
execute function public.prevent_non_admin_rejection_updates();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.patients enable row level security;
alter table public.fedex_packages enable row level security;
alter table public.samples enable row level security;
alter table public.patient_documents enable row level security;

create policy "admins manage all companies"
on public.companies
for all
using (public.is_admin())
with check (public.is_admin());

create policy "customers read their company"
on public.companies
for select
using (id = public.current_company_id());

create policy "admins manage all profiles"
on public.user_profiles
for all
using (public.is_admin())
with check (public.is_admin());

create policy "users read their own profile"
on public.user_profiles
for select
using (id = auth.uid());

create policy "users update their own profile"
on public.user_profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.current_app_role()
  and (
    public.current_company_id() is null
    or company_id = public.current_company_id()
  )
);

create policy "admins manage all patients"
on public.patients
for all
using (public.is_admin())
with check (public.is_admin());

create policy "company users manage their patients"
on public.patients
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "admins manage all packages"
on public.fedex_packages
for all
using (public.is_admin())
with check (public.is_admin());

create policy "company users manage their packages"
on public.fedex_packages
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "admins manage all samples"
on public.samples
for all
using (public.is_admin())
with check (public.is_admin());

create policy "company users manage their samples"
on public.samples
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "admins manage all documents"
on public.patient_documents
for all
using (public.is_admin())
with check (public.is_admin());

create policy "company users manage their documents"
on public.patient_documents
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.sample_search to authenticated, service_role;
grant select, insert, update, delete on public.companies to authenticated, service_role;
grant select, insert, update, delete on public.user_profiles to authenticated, service_role;
grant select, insert, update, delete on public.patients to authenticated, service_role;
grant select, insert, update, delete on public.fedex_packages to authenticated, service_role;
grant select, insert, update, delete on public.samples to authenticated, service_role;
grant select, insert, update, delete on public.patient_documents to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  26214400,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

create policy "admins manage patient document objects"
on storage.objects
for all
using (bucket_id = 'patient-documents' and public.is_admin())
with check (bucket_id = 'patient-documents' and public.is_admin());

create policy "company users access scoped document objects"
on storage.objects
for all
using (
  bucket_id = 'patient-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
)
with check (
  bucket_id = 'patient-documents'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);
