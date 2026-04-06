-- Load rows from a staging table into public.companies.
-- Suggested workflow:
-- 1. Collect company rows in a CSV file.
-- 2. Import that CSV into data_eng.company_import_staging.
-- 3. Run this script to upsert into public.companies.

create schema if not exists data_eng;

create table if not exists data_eng.company_import_staging (
  id uuid,
  name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  contact_phone text,
  contact_email text
);

insert into public.companies (
  id,
  name,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  contact_phone,
  contact_email
)
select
  coalesce(id, gen_random_uuid()) as id,
  trim(name) as name,
  nullif(trim(address_line_1), '') as address_line_1,
  nullif(trim(address_line_2), '') as address_line_2,
  nullif(trim(city), '') as city,
  nullif(trim(state), '') as state,
  nullif(trim(postal_code), '') as postal_code,
  nullif(trim(contact_phone), '') as contact_phone,
  nullif(trim(contact_email), '') as contact_email
from data_eng.company_import_staging
where nullif(trim(name), '') is not null
on conflict (id) do update
set
  name = excluded.name,
  address_line_1 = excluded.address_line_1,
  address_line_2 = excluded.address_line_2,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  contact_phone = excluded.contact_phone,
  contact_email = excluded.contact_email,
  updated_at = timezone('utc', now());

-- Optional cleanup after each load:
-- truncate table data_eng.company_import_staging;
