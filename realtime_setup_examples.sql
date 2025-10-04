-- Supabase Realtime 설정 예시들

-- 1. 실시간 발행 활성화 (기본적인 방법)
ALTER PUBLICATION supabase_realtime ADD TABLE product_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE tour_updates;

-- 2. 특정 컬럼만 실시간 발행 (보안상 좋음)
ALTER PUBLICATION supabase_realtime ADD TABLE users (username, status, last_active);
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages (message, created_at);

-- 3. 여러 테이블 한번에 추가
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY['product_schedules', 'reservations', 'tour_updates', 'chat_messages'])
    LOOP
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    END LOOP;
END $$;

-- 4. 실시간 발행 상태 확인
SELECT 
    pubname as publication_name,
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 5. 특정 테이블만 실시간 발행에서 제거 (필요한 경우)
-- ALTER PUBLICATION supabase_realtime DROP TABLE sensitive_data;
