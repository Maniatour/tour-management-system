-- Fix documents RLS: legacy policies queried auth.users directly, causing 403 on SELECT.
-- Replaces broken admin checks with rls_*_session_ok() helpers (team table based).
--
-- Depends: rls_team_member_session_ok, rls_is_staff_session_ok, rls_admin_session_ok,
--          rls_email_eq_session_or_current (20260621260000+).

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'documents',
    'document_categories',
    'document_reminders',
    'document_permissions',
    'document_download_logs'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon', t);
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated',
        t
      );
    end if;
  end loop;
end$$;

-- =============================================================================
-- documents
-- =============================================================================
drop policy if exists "Admins can access all documents" on public.documents;
drop policy if exists "Users can access their own documents" on public.documents;
drop policy if exists "documents_select" on public.documents;
drop policy if exists "documents_insert" on public.documents;
drop policy if exists "documents_update" on public.documents;
drop policy if exists "documents_delete" on public.documents;
drop policy if exists "documents_team_all" on public.documents;

create policy "documents_select"
  on public.documents for select to authenticated
  using (
    public.rls_team_member_session_ok()
    or created_by = auth.uid()
    or public.rls_email_eq_session_or_current(guide_email)
    or exists (
      select 1
      from public.document_permissions dp
      where dp.document_id = documents.id
        and dp.user_id = auth.uid()
        and dp.permission_type in ('view', 'edit', 'delete')
    )
  );

create policy "documents_insert"
  on public.documents for insert to authenticated
  with check (
    public.rls_team_member_session_ok()
    or created_by = auth.uid()
    or public.rls_email_eq_session_or_current(guide_email)
  );

create policy "documents_update"
  on public.documents for update to authenticated
  using (
    public.rls_team_member_session_ok()
    or created_by = auth.uid()
    or public.rls_email_eq_session_or_current(guide_email)
    or exists (
      select 1
      from public.document_permissions dp
      where dp.document_id = documents.id
        and dp.user_id = auth.uid()
        and dp.permission_type in ('edit', 'delete')
    )
  )
  with check (
    public.rls_team_member_session_ok()
    or created_by = auth.uid()
    or public.rls_email_eq_session_or_current(guide_email)
    or exists (
      select 1
      from public.document_permissions dp
      where dp.document_id = documents.id
        and dp.user_id = auth.uid()
        and dp.permission_type in ('edit', 'delete')
    )
  );

create policy "documents_delete"
  on public.documents for delete to authenticated
  using (
    public.rls_team_member_session_ok()
    or created_by = auth.uid()
    or exists (
      select 1
      from public.document_permissions dp
      where dp.document_id = documents.id
        and dp.user_id = auth.uid()
        and dp.permission_type = 'delete'
    )
  );

-- =============================================================================
-- document_categories
-- =============================================================================
drop policy if exists "Authenticated users can view categories" on public.document_categories;
drop policy if exists "Admins can manage categories" on public.document_categories;
drop policy if exists "document_categories_select" on public.document_categories;
drop policy if exists "document_categories_write_staff" on public.document_categories;

create policy "document_categories_select"
  on public.document_categories for select to authenticated
  using (public.rls_team_member_session_ok());

create policy "document_categories_write_staff"
  on public.document_categories for all to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

-- =============================================================================
-- document_permissions
-- =============================================================================
drop policy if exists "Users can view their permissions" on public.document_permissions;
drop policy if exists "Admins can manage permissions" on public.document_permissions;
drop policy if exists "document_permissions_select" on public.document_permissions;
drop policy if exists "document_permissions_write_staff" on public.document_permissions;

create policy "document_permissions_select"
  on public.document_permissions for select to authenticated
  using (
    user_id = auth.uid()
    or public.rls_team_member_session_ok()
  );

create policy "document_permissions_write_staff"
  on public.document_permissions for all to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

-- =============================================================================
-- document_reminders
-- =============================================================================
drop policy if exists "Users can view their reminders" on public.document_reminders;
drop policy if exists "document_reminders_select" on public.document_reminders;

create policy "document_reminders_select"
  on public.document_reminders for select to authenticated
  using (
    sent_to_user_id = auth.uid()
    or public.rls_team_member_session_ok()
    or exists (
      select 1
      from public.documents d
      where d.id = document_reminders.document_id
        and (
          d.created_by = auth.uid()
          or public.rls_email_eq_session_or_current(d.guide_email)
        )
    )
  );

-- =============================================================================
-- document_download_logs
-- =============================================================================
drop policy if exists "Users can view their download logs" on public.document_download_logs;
drop policy if exists "Admins can view all download logs" on public.document_download_logs;
drop policy if exists "document_download_logs_select" on public.document_download_logs;
drop policy if exists "document_download_logs_insert" on public.document_download_logs;

create policy "document_download_logs_select"
  on public.document_download_logs for select to authenticated
  using (
    user_id = auth.uid()
    or public.rls_team_member_session_ok()
  );

create policy "document_download_logs_insert"
  on public.document_download_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.rls_team_member_session_ok()
  );

commit;
