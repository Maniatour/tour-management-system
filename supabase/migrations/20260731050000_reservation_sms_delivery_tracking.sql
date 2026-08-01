-- SMS 발송 이력 확장: 카테고리·Twilio 배달 상태 추적
begin;

alter table public.pre_tour_contact_sms_logs
  add column if not exists category_id text not null default 'pre_tour_contact',
  add column if not exists delivered_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists twilio_status text;

comment on column public.pre_tour_contact_sms_logs.category_id is
  'SMS 카테고리 (pre_tour_contact, pickup_notification 등)';

comment on column public.pre_tour_contact_sms_logs.delivered_at is
  'Twilio 배달 완료 시각';

comment on column public.pre_tour_contact_sms_logs.failed_at is
  'Twilio 배달 실패 시각';

comment on column public.pre_tour_contact_sms_logs.failure_reason is
  'Twilio 배달 실패 사유 (ErrorCode 등)';

comment on column public.pre_tour_contact_sms_logs.twilio_status is
  'Twilio MessageStatus 원본 값';

create index if not exists idx_pre_tour_contact_sms_logs_twilio_sid
  on public.pre_tour_contact_sms_logs (twilio_message_sid)
  where twilio_message_sid is not null;

create index if not exists idx_pre_tour_contact_sms_logs_category
  on public.pre_tour_contact_sms_logs (reservation_id, category_id, created_at desc);

grant update on table public.pre_tour_contact_sms_logs to authenticated;

create policy "pre_tour_contact_sms_logs_update_staff"
  on public.pre_tour_contact_sms_logs for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

commit;
