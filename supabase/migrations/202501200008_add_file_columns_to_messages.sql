-- team_chat_messages 테이블에 파일 관련 컬럼 추가
ALTER TABLE public.team_chat_messages 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 컬럼 추가 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team_chat_messages' 
AND table_schema = 'public'
AND column_name IN ('file_url', 'file_name', 'file_size', 'file_type');

-- 성공 메시지
SELECT 'team_chat_messages 테이블에 파일 관련 컬럼이 추가되었습니다.' as message;
