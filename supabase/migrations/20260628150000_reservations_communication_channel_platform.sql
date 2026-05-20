-- 소통 채널: platform 추가, GetYourGuide 등 플랫폼 채팅 예약 기본값
begin;

alter table public.reservations
  drop constraint if exists reservations_customer_communication_channel_check;

alter table public.reservations
  add constraint reservations_customer_communication_channel_check
  check (
    customer_communication_channel is null
    or customer_communication_channel in (
      'no_reply',
      'platform',
      'email',
      'whatsapp',
      'text_message',
      'kakaotalk',
      'phone_call',
      'chatroom'
    )
  );

comment on column public.reservations.customer_communication_channel is
  'Staff-tracked customer communication channel: no_reply, platform (OTA in-app chat), email, whatsapp, text_message, kakaotalk, phone_call, chatroom';

-- GetYourGuide: 자체 채팅 플랫폼으로 소통 → 미설정 시 platform
update public.reservations r
set customer_communication_channel = 'platform'
where r.customer_communication_channel is null
  and (
    lower(trim(r.channel_id)) = 'getyourguide'
    or lower(coalesce(r.channel_rn, '')) like '%getyourguide%'
    or lower(coalesce(r.channel_rn, '')) like '%get your guide%'
  );

commit;
