-- 빠른 해결: payment_records 테이블을 동기화 드롭다운에 표시

-- 1. 기존 publication에서 제거 (있다면)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.payment_records;

-- 2. 다시 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;

-- 3. 모든 권한 부여
GRANT ALL ON public.payment_records TO authenticated;
GRANT ALL ON public.payment_records TO anon;
GRANT ALL ON public.payment_records TO service_role;

-- 4. 스키마 권한 부여
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- 5. 테이블 소유자를 postgres로 변경
ALTER TABLE public.payment_records OWNER TO postgres;

-- 6. RLS 일시 비활성화 (동기화 설정 후 다시 활성화)
ALTER TABLE public.payment_records DISABLE ROW LEVEL SECURITY;

-- 7. 확인
SELECT 
  'payment_records added to realtime publication' as status,
  now() as timestamp;

-- 8. publication에 포함된 테이블 목록 확인
SELECT 
  p.pubname,
  c.relname as table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
AND c.relname = 'payment_records';
