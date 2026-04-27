update public.user_profiles
set role = 'customer'
where role = 'clinic_admin';

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
      and up.role = 'admin'
  )
);
