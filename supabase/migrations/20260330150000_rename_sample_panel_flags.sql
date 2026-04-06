do $$
begin
  alter table public.samples
  add column if not exists hart_cadhs boolean not null default false;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'samples'
      and column_name = 'hart'
  ) then
    execute $sql$
      update public.samples
      set hart_cadhs = coalesce(hart, false) or coalesce(cadhs, false)
    $sql$;
  end if;

  alter table public.samples drop column if exists hart;
  alter table public.samples drop column if exists cadhs;
end
$$;
