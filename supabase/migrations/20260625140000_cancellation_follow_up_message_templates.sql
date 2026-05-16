-- 취소 후 Follow-up 이메일·문자 템플릿 (locale × channel × message_kind)
-- 플레이스홀더: {{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}}
begin;

create table if not exists public.cancellation_follow_up_message_templates (
  locale text not null check (locale in ('ko', 'en')),
  channel text not null check (channel in ('email', 'sms')),
  message_kind text not null check (message_kind in ('follow_up', 'rebooking')),
  subject_template text,
  body_template text not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (locale, channel, message_kind)
);

comment on table public.cancellation_follow_up_message_templates is
  '취소 후 고객 안내 이메일·문자 복사용 템플릿. subject_template은 SMS에서 null.';

alter table public.cancellation_follow_up_message_templates enable row level security;

drop policy if exists "Allow all access to cancellation_follow_up_message_templates"
  on public.cancellation_follow_up_message_templates;

revoke all on table public.cancellation_follow_up_message_templates from anon;
grant select, insert, update, delete on table public.cancellation_follow_up_message_templates to authenticated;

create policy "cancellation_follow_up_message_templates_select_staff"
  on public.cancellation_follow_up_message_templates for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "cancellation_follow_up_message_templates_insert_staff"
  on public.cancellation_follow_up_message_templates for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "cancellation_follow_up_message_templates_update_staff"
  on public.cancellation_follow_up_message_templates for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "cancellation_follow_up_message_templates_delete_staff"
  on public.cancellation_follow_up_message_templates for delete to authenticated
  using (public.rls_is_staff_session_ok());

commit;
