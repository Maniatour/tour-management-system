-- product_schedules 테이블 실시간 업데이트 활성화

-- 1. 실시간 발행 목록에서 제거 (이미 있다면)
SELECT publications_drop(topic_name := 'product_schedules');

-- 2. 새로운 실시간 발행 생성
SELECT publications_create(topic_name := 'product_schedules');

-- 3. 테이블을 실시간 발행에 추가
SELECT publications_execute(
  topic_name := 'product_schedules',
  sql := 'ALTER PUBLICATION supabase_realtime ADD TABLE product_schedules;'
);

-- 또는 직접 방식:
-- ALTER PUBLICATION supabase_realtime ADD TABLE product_schedules;

-- 4. 실시간 발행 목록 확인
SELECT 
    pubname as publication_name,
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- 5. 성공 메시지
SELECT 'product_schedules 실시간 업데이트 활성화 완료' as status;
