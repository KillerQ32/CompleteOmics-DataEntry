create table if not exists public.clinic_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  address_line_1 text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  contact_email text not null,
  contact_phone text not null,
  fax_number text,
  requester_first_name text not null,
  requester_last_name text not null,
  requester_email text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.clinic_requests enable row level security;

drop policy if exists "Admins can manage clinic requests" on public.clinic_requests;
create policy "Admins can manage clinic requests"
  on public.clinic_requests
  for all
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'admin'
    )
  );
