-- 예약별 고객 소통 채널 (간단 카드뷰 등)
begin;

alter table public.reservations
  add column if not exists customer_communication_channel text;

comment on column public.reservations.customer_communication_channel is
  'Staff-tracked active customer communication channel: no_reply, platform, email, whatsapp, text_message, kakaotalk, phone_call, chatroom';

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

commit;
