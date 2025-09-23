-- payment_records 테이블이 동기화 설정 드롭다운에 나타나지 않는 문제 해결

-- 1. 현재 테이블 상태 확인
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'payment_records';

-- 2. Real-time publication 상태 확인
SELECT 
  p.pubname,
  p.puballtables,
  p.pubinsert,
  p.pubupdate,
  p.pubdelete
FROM pg_publication p
WHERE p.pubname = 'supabase_realtime';

-- 3. publication에 포함된 테이블 확인
SELECT 
  p.pubname,
  c.relname as table_name,
  c.relkind
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;

-- 4. payment_records가 publication에 있는지 확인
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication p
      JOIN pg_publication_rel pr ON p.oid = pr.prpubid
      JOIN pg_class c ON pr.prrelid = c.oid
      WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'payment_records'
    ) THEN 'YES' 
    ELSE 'NO' 
  END as is_in_realtime_publication;

-- 5. 테이블 권한 확인
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'payment_records'
AND table_schema = 'public';

-- 6. RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'payment_records';

-- 7. 테이블을 Real-time publication에 강제로 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;

-- 8. 모든 필요한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- 9. 테이블 소유자 확인 및 변경 (필요시)
-- ALTER TABLE public.payment_records OWNER TO postgres;

-- 10. 다시 확인
SELECT 
  p.pubname,
  c.relname as table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
AND c.relname = 'payment_records';

-- 11. 테이블이 동기화 가능한지 확인
SELECT 
  'payment_records' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication p
      JOIN pg_publication_rel pr ON p.oid = pr.prpubid
      JOIN pg_class c ON pr.prrelid = c.oid
      WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'payment_records'
    ) THEN 'READY FOR SYNC'
    ELSE 'NOT READY'
  END as sync_status;
