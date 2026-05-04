create unique index if not exists companies_name_lower_unique_idx
  on public.companies (lower(name));

create unique index if not exists clinic_requests_active_name_lower_unique_idx
  on public.clinic_requests (lower(clinic_name))
  where status in ('pending', 'reviewing');

create unique index if not exists clinic_requests_active_requester_email_lower_unique_idx
  on public.clinic_requests (lower(requester_email))
  where status in ('pending', 'reviewing');
