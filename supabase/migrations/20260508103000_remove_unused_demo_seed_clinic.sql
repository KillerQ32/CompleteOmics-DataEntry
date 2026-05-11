delete from public.companies c
where c.id = '99999999-9999-9999-9999-999999999999'
  and not exists (
    select 1
    from public.user_profiles up
    where up.company_id = c.id
  )
  and not exists (
    select 1
    from public.patients p
    where p.company_id = c.id
  )
  and not exists (
    select 1
    from public.samples s
    where s.company_id = c.id
  )
  and not exists (
    select 1
    from public.fedex_packages fp
    where fp.company_id = c.id
  )
  and not exists (
    select 1
    from public.patient_documents pd
    where pd.company_id = c.id
  )
  and not exists (
    select 1
    from public.pending_intake_documents pid
    where pid.company_id = c.id
  )
  and not exists (
    select 1
    from public.contact_messages cm
    where cm.company_id = c.id
  );
