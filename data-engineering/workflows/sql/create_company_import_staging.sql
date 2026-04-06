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
