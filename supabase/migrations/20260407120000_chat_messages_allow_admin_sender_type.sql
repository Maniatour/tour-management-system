-- 투어 채팅: 관리자(채팅 관리 화면) 메시지는 sender_type = 'admin' 을 사용함.
-- 기존 CHECK 는 guide/customer/system 만 허용하여 INSERT 시 23514 오류 발생.

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_sender_type_check
  CHECK (sender_type IN ('guide', 'customer', 'system', 'admin'));

COMMENT ON COLUMN public.chat_messages.sender_type IS 'Type of sender: guide, customer, system, or admin (office staff via chat management)';
