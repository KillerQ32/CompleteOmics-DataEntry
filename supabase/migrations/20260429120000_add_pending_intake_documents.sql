create table if not exists public.pending_intake_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_key text not null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pending_intake_documents_company_id_idx
  on public.pending_intake_documents (company_id);

create index if not exists pending_intake_documents_user_id_idx
  on public.pending_intake_documents (user_id);

create index if not exists pending_intake_documents_draft_key_idx
  on public.pending_intake_documents (draft_key);

alter table public.pending_intake_documents enable row level security;

drop policy if exists "admins manage all pending intake documents" on public.pending_intake_documents;
create policy "admins manage all pending intake documents"
on public.pending_intake_documents
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "company users manage their pending intake documents" on public.pending_intake_documents;
create policy "company users manage their pending intake documents"
on public.pending_intake_documents
for all
using (company_id = public.current_company_id() and user_id = auth.uid())
with check (company_id = public.current_company_id() and user_id = auth.uid());

grant select, insert, update, delete on public.pending_intake_documents to authenticated, service_role;
