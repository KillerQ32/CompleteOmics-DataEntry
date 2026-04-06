insert into public.companies (
  id,
  name,
  address_line_1,
  city,
  state,
  postal_code,
  contact_phone,
  contact_email
)
values (
  '99999999-9999-9999-9999-999999999999',
  'Complete Omics Admin Test Clinic',
  '100 Portal Way',
  'Columbia',
  'MD',
  '21046',
  '443-555-0101',
  'admin-test@completeomics.example'
)
on conflict (id) do nothing;
