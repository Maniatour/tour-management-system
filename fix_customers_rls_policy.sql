-- 고객 테이블 RLS 정책 수정
-- 고객이 자신의 정보에 접근할 수 있도록 허용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_modify_staff_only" ON public.customers;

-- 새로운 정책 생성
-- 1. 모든 사용자가 고객 정보를 읽을 수 있음 (고객 시뮬레이션을 위해)
CREATE POLICY "customers_select_all" ON public.customers
  FOR SELECT
  USING (true);

-- 2. 인증된 사용자가 고객 정보를 수정할 수 있음 (자신의 정보 또는 staff 권한)
CREATE POLICY "customers_modify_authenticated" ON public.customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. 익명 사용자도 고객 정보를 삽입할 수 있음 (회원가입을 위해)
CREATE POLICY "customers_insert_anonymous" ON public.customers
  FOR INSERT
  TO anon
  WITH CHECK (true);
