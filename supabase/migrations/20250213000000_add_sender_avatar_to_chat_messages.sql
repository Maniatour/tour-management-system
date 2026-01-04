-- chat_messages 테이블에 sender_avatar 컬럼 추가
-- Migration: 20250213000000_add_sender_avatar_to_chat_messages

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS sender_avatar TEXT;

-- 컬럼 추가 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND table_schema = 'public'
AND column_name = 'sender_avatar';

-- 성공 메시지
SELECT 'chat_messages 테이블에 sender_avatar 컬럼이 추가되었습니다.' as message;


