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
  'Demo Cardiology Clinic',
  '100 Example Way',
  'Baltimore',
  'MD',
  '21046',
  '443-555-0101',
  'clinic-admin@example.com'
)
on conflict (id) do nothing;
