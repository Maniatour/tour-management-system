-- product_details 테이블의 RLS를 올바르게 설정

-- 1) 기존 정책 모두 제거
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.product_details;
DROP POLICY IF EXISTS "Allow read for anonymous users" ON public.product_details;
DROP POLICY IF EXISTS "product_details_staff_all" ON public.product_details;
DROP POLICY IF EXISTS "product_details_anon_read" ON public.product_details;

-- 2) staff 판별 함수 (이미 존재할 수 있으므로 확인)
CREATE OR REPLACE FUNCTION public.is_staff(p_email text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team
    WHERE lower(email) = lower(p_email) AND is_active = true
  );
$$;

-- 3) 세션 이메일 읽기 함수 (이미 존재할 수 있으므로 확인)
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- 4) RLS 활성화
ALTER TABLE public.product_details ENABLE ROW LEVEL SECURITY;

-- 5) staff에게 모든 작업 허용 (가장 중요한 정책)
CREATE POLICY "product_details_staff_all_operations" ON public.product_details
  FOR ALL 
  TO authenticated
  USING (public.is_staff(public.current_email()))
  WITH CHECK (public.is_staff(public.current_email()));

-- 6) 익명 사용자에게 읽기 허용
CREATE POLICY "product_details_anon_read" ON public.product_details
  FOR SELECT 
  TO anon
  USING (true);

-- 7) RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'product_details';

-- 8) 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'product_details';
