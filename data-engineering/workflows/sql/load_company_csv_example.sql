-- Example for loading a CSV after you place it on the database host.
-- Update the file path before running.

copy data_eng.company_import_staging (
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
from '/path/to/company-intake-template.csv'
with (
  format csv,
  header true
);
