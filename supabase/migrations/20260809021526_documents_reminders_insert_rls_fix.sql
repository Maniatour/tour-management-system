-- Fix documents upload 403 for office managers / staff:
-- AFTER INSERT trigger create_document_reminders() inserts into document_reminders,
-- but that table only had a SELECT policy → RLS blocks the insert and the whole
-- documents INSERT fails with 403 when expiry_date + reminder flags are set.
--
-- Also drop legacy guide/admin policies that query public.team under invoker
-- (can raise permission denied). Covered by documents_* session helpers.

begin;

-- ---------------------------------------------------------------------------
-- document_reminders: allow staff/team writes + make trigger bypass RLS
-- ---------------------------------------------------------------------------
drop policy if exists "document_reminders_select" on public.document_reminders;
drop policy if exists "document_reminders_insert" on public.document_reminders;
drop policy if exists "document_reminders_update" on public.document_reminders;
drop policy if exists "document_reminders_delete" on public.document_reminders;
drop policy if exists "Users can view their reminders" on public.document_reminders;
drop policy if exists "Admins can manage reminders" on public.document_reminders;

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

create policy "document_reminders_insert"
  on public.document_reminders for insert to authenticated
  with check (
    public.rls_team_member_session_ok()
    or sent_to_user_id = auth.uid()
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

create policy "document_reminders_update"
  on public.document_reminders for update to authenticated
  using (
    public.rls_team_member_session_ok()
    or sent_to_user_id = auth.uid()
  )
  with check (
    public.rls_team_member_session_ok()
    or sent_to_user_id = auth.uid()
  );

create policy "document_reminders_delete"
  on public.document_reminders for delete to authenticated
  using (public.rls_team_member_session_ok());

create or replace function public.create_document_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  reminder_30_date date;
  reminder_7_date date;
begin
  if new.expiry_date is not null then
    if coalesce(new.reminder_30_days, false) then
      reminder_30_date := new.expiry_date - interval '30 days';
      insert into public.document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      values (new.id, '30_days', reminder_30_date, new.created_by);
    end if;

    if coalesce(new.reminder_7_days, false) then
      reminder_7_date := new.expiry_date - interval '7 days';
      insert into public.document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      values (new.id, '7_days', reminder_7_date, new.created_by);
    end if;

    if coalesce(new.reminder_expired, false) then
      insert into public.document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      values (new.id, 'expired', new.expiry_date, new.created_by);
    end if;
  end if;

  return new;
end;
$$;

comment on function public.create_document_reminders() is
  'AFTER INSERT on documents: create reminder rows. SECURITY DEFINER bypasses document_reminders RLS.';

revoke all on function public.create_document_reminders() from public;
grant execute on function public.create_document_reminders() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- documents: remove legacy policies that query team via auth.email()
-- ---------------------------------------------------------------------------
drop policy if exists "Admins and managers can manage all guide documents" on public.documents;
drop policy if exists "Admins and managers can view all guide documents" on public.documents;
drop policy if exists "Guides can delete their own documents" on public.documents;
drop policy if exists "Guides can insert their own documents" on public.documents;
drop policy if exists "Guides can update their own documents" on public.documents;
drop policy if exists "Guides can view their own documents" on public.documents;

commit;
