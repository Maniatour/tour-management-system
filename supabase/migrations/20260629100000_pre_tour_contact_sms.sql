-- 투어 사전 연락 SMS (Twilio) 템플릿·메신저 연락처·발송 로그
begin;

create table if not exists public.pre_tour_contact_sms_templates (
  locale text not null check (locale in ('ko', 'en', 'ja')),
  body_template text not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (locale)
);

comment on table public.pre_tour_contact_sms_templates is
  '투어 사전 연락 SMS 템플릿. 플레이스홀더: {{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}}, {{PICKUP_TIME}}, {{PICKUP_HOTEL}}, {{LINE_ID}}, {{WHATSAPP}}, {{KAKAO}}, {{CONTACT_EMAIL}}, {{CHAT_ROOM_URL}}';

alter table public.pre_tour_contact_sms_templates enable row level security;

revoke all on table public.pre_tour_contact_sms_templates from anon;
grant select, insert, update, delete on table public.pre_tour_contact_sms_templates to authenticated;

create policy "pre_tour_contact_sms_templates_select_staff"
  on public.pre_tour_contact_sms_templates for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "pre_tour_contact_sms_templates_insert_staff"
  on public.pre_tour_contact_sms_templates for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "pre_tour_contact_sms_templates_update_staff"
  on public.pre_tour_contact_sms_templates for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "pre_tour_contact_sms_templates_delete_staff"
  on public.pre_tour_contact_sms_templates for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- 메신저 연락처 (단일 행)
create table if not exists public.customer_messenger_contact_settings (
  id smallint primary key default 1 check (id = 1),
  line_id text not null default 'maniatour',
  whatsapp text not null default '7024445531',
  kakao text not null default 'vegasmaniatour',
  contact_email text not null default 'vegasmanitour@gmail.com',
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.customer_messenger_contact_settings is
  '고객 안내 SMS·이메일에 삽입되는 LINE/WhatsApp/Kakao/이메일 연락처';

insert into public.customer_messenger_contact_settings (id, line_id, whatsapp, kakao, contact_email)
values (1, 'maniatour', '7024445531', 'vegasmaniatour', 'vegasmanitour@gmail.com')
on conflict (id) do nothing;

alter table public.customer_messenger_contact_settings enable row level security;

revoke all on table public.customer_messenger_contact_settings from anon;
grant select, insert, update, delete on table public.customer_messenger_contact_settings to authenticated;

create policy "customer_messenger_contact_settings_select_staff"
  on public.customer_messenger_contact_settings for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "customer_messenger_contact_settings_update_staff"
  on public.customer_messenger_contact_settings for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "customer_messenger_contact_settings_insert_staff"
  on public.customer_messenger_contact_settings for insert to authenticated
  with check (public.rls_is_staff_session_ok());

-- SMS 발송 로그
create table if not exists public.pre_tour_contact_sms_logs (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null,
  customer_id text,
  to_phone text not null,
  message_body text not null,
  locale text not null check (locale in ('ko', 'en', 'ja')),
  twilio_message_sid text,
  status text not null default 'sent',
  error_message text,
  sent_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pre_tour_contact_sms_logs_reservation
  on public.pre_tour_contact_sms_logs (reservation_id, created_at desc);

comment on table public.pre_tour_contact_sms_logs is
  'Twilio 투어 사전 연락 SMS 발송 이력';

alter table public.pre_tour_contact_sms_logs enable row level security;

revoke all on table public.pre_tour_contact_sms_logs from anon;
grant select, insert on table public.pre_tour_contact_sms_logs to authenticated;

create policy "pre_tour_contact_sms_logs_select_staff"
  on public.pre_tour_contact_sms_logs for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "pre_tour_contact_sms_logs_insert_staff"
  on public.pre_tour_contact_sms_logs for insert to authenticated
  with check (public.rls_is_staff_session_ok());

commit;
