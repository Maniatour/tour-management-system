-- 관리자 SMS 템플릿 (픽업 알림, 가이드 스케줄 컨펌 등)
begin;

create table if not exists public.admin_sms_templates (
  template_key text not null check (template_key in ('pickup_notification', 'guide_schedule_confirm')),
  locale text not null,
  body_template text not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (template_key, locale)
);

comment on table public.admin_sms_templates is
  '관리자 SMS 템플릿. pickup_notification / guide_schedule_confirm. locale: ko, en, ja, zh 등.';

alter table public.admin_sms_templates enable row level security;

revoke all on table public.admin_sms_templates from anon;
grant select, insert, update, delete on table public.admin_sms_templates to authenticated;

create policy "admin_sms_templates_select_staff"
  on public.admin_sms_templates for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "admin_sms_templates_insert_staff"
  on public.admin_sms_templates for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "admin_sms_templates_update_staff"
  on public.admin_sms_templates for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "admin_sms_templates_delete_staff"
  on public.admin_sms_templates for delete to authenticated
  using (public.rls_is_staff_session_ok());

commit;
