alter table public.companies
  add column if not exists fax_number text;

alter table public.patients
  add column if not exists phone_number text,
  add column if not exists email_address text;
