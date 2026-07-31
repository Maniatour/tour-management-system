-- SMS 관리 카테고리 표시명·아이콘 설정
begin;

create table if not exists public.admin_sms_category_settings (
  category_key text primary key,
  label_ko text not null,
  label_en text not null,
  icon_key text not null default 'smartphone',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.admin_sms_category_settings is
  'SMS 관리 카테고리 표시명·아이콘. category_key는 adminSmsTemplateCatalog의 id와 동일.';

alter table public.admin_sms_category_settings enable row level security;

revoke all on table public.admin_sms_category_settings from anon;
grant select, insert, update, delete on table public.admin_sms_category_settings to authenticated;

create policy "admin_sms_category_settings_select_staff"
  on public.admin_sms_category_settings for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "admin_sms_category_settings_insert_staff"
  on public.admin_sms_category_settings for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "admin_sms_category_settings_update_staff"
  on public.admin_sms_category_settings for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "admin_sms_category_settings_delete_staff"
  on public.admin_sms_category_settings for delete to authenticated
  using (public.rls_is_staff_session_ok());

insert into public.admin_sms_category_settings (category_key, label_ko, label_en, icon_key, sort_order)
values
  ('pre_tour_contact', '투어 사전 연락', 'Pre-tour contact', 'smartphone', 10),
  ('pickup_notification', '픽업 알림', 'Pickup notification', 'bus', 20),
  ('guide_schedule_confirm', '가이드 스케줄 컨펌', 'Guide schedule confirm', 'calendar', 30),
  ('cancellation_follow_up', '취소 Follow-up', 'Cancellation follow-up', 'message-square', 40),
  ('cancellation_rebooking', '취소 재예약', 'Cancellation rebooking', 'rotate-ccw', 50),
  ('pending_alt_tour', 'Pending 대체 투어', 'Pending alt tour', 'clock', 60),
  ('messenger_contacts', '메신저 연락처', 'Messenger contacts', 'messages-square', 70)
on conflict (category_key) do nothing;

commit;
