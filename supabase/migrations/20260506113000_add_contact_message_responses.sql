alter table public.contact_messages
  add column if not exists admin_response text,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_by uuid references auth.users (id) on delete set null,
  add column if not exists response_email_sent_at timestamptz;

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
  cm.admin_response,
  cm.responded_at,
  cm.responded_by,
  cm.response_email_sent_at,
  cm.created_at
from public.contact_messages cm
left join public.companies c on c.id = cm.company_id;

grant select on public.contact_message_directory to authenticated, service_role;
