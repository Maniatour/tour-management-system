-- payment_records 테이블 Real-time 동기화 활성화

-- Real-time publication에 테이블 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;

-- 필요한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO anon;

-- Real-time 구독을 위한 추가 설정
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 테이블 접근 권한 확인
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'payment_records';

-- Real-time publication 확인
SELECT 
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- publication에 포함된 테이블 확인
SELECT 
  p.pubname,
  p.puballtables,
  c.relname as table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
AND c.relname = 'payment_records';
