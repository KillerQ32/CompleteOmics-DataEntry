create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  first_name text,
  last_name text,
  email text not null,
  institution text,
  purpose text,
  source text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'closed')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contact_messages_company_id_idx on public.contact_messages (company_id);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status);

alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_select_for_staff" on public.contact_messages;
create policy "contact_messages_select_for_staff"
on public.contact_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and (
        up.role = 'admin'
        or (up.role = 'clinic_admin' and up.company_id = contact_messages.company_id)
      )
  )
);

drop policy if exists "contact_messages_insert_own" on public.contact_messages;
create policy "contact_messages_insert_own"
on public.contact_messages
for insert
to authenticated
with check (user_id = auth.uid());

drop view if exists public.contact_message_directory;

create view public.contact_message_directory
with (security_invoker = true) as
select
  cm.id,
  cm.user_id,
  cm.company_id,
  c.name as company_name,
  cm.first_name,
  cm.last_name,
  cm.email,
  cm.institution,
  cm.purpose,
  cm.source,
  cm.message,
  cm.status,
  cm.created_at
from public.contact_messages cm
left join public.companies c on c.id = cm.company_id;

grant select on public.contact_message_directory to authenticated, service_role;
grant select, insert, update on public.contact_messages to authenticated, service_role;
