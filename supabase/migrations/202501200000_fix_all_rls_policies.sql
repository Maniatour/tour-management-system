-- 모든 테이블의 RLS 정책을 일관되게 수정
-- team 테이블 기반 권한 시스템으로 통일

BEGIN;

-- 1. 공통 함수들 생성/업데이트
-- 현재 사용자 이메일 가져오기 함수
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- staff 여부 확인 함수 (team 테이블 기반)
CREATE OR REPLACE FUNCTION public.is_staff(p_email text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team
    WHERE lower(email) = lower(coalesce(p_email, public.current_email()))
    AND is_active = true
  )
$$;

-- 2. team 테이블 RLS 설정
ALTER TABLE public.team ENABLE ROW LEVEL SECURITY;

-- team 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "team_select_all" ON public.team;
DROP POLICY IF EXISTS "team_modify_staff_only" ON public.team;
DROP POLICY IF EXISTS "team_insert_staff" ON public.team;
DROP POLICY IF EXISTS "team_update_staff" ON public.team;
DROP POLICY IF EXISTS "team_delete_staff" ON public.team;

-- team 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "team_select_all" ON public.team
  FOR SELECT
  USING (true);

CREATE POLICY "team_modify_staff_only" ON public.team
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3. tours 테이블 RLS 설정
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- tours 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "tours_select_assigned_or_staff" ON public.tours;
DROP POLICY IF EXISTS "tours_select_all" ON public.tours;
DROP POLICY IF EXISTS "tours_modify_staff_only" ON public.tours;
DROP POLICY IF EXISTS "tours_insert_staff" ON public.tours;
DROP POLICY IF EXISTS "tours_update_staff" ON public.tours;
DROP POLICY IF EXISTS "tours_delete_staff" ON public.tours;

-- tours 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "tours_select_all" ON public.tours
  FOR SELECT
  USING (true);

CREATE POLICY "tours_modify_staff_only" ON public.tours
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 4. reservations 테이블 RLS 설정
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- reservations 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "reservations_select_staff_all" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_assigned_via_tour" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_all" ON public.reservations;
DROP POLICY IF EXISTS "reservations_modify_staff_only" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_staff" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_staff" ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_staff" ON public.reservations;

-- reservations 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "reservations_select_all" ON public.reservations
  FOR SELECT
  USING (true);

CREATE POLICY "reservations_modify_staff_only" ON public.reservations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5. customers 테이블 RLS 설정
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- customers 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_modify_staff_only" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers;
DROP POLICY IF EXISTS "customers_update_staff" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_staff" ON public.customers;

-- customers 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "customers_select_all" ON public.customers
  FOR SELECT
  USING (true);

CREATE POLICY "customers_modify_staff_only" ON public.customers
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 6. products 테이블 RLS 설정
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- products 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_modify_staff_only" ON public.products;
DROP POLICY IF EXISTS "products_insert_staff" ON public.products;
DROP POLICY IF EXISTS "products_update_staff" ON public.products;
DROP POLICY IF EXISTS "products_delete_staff" ON public.products;

-- products 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "products_select_all" ON public.products
  FOR SELECT
  USING (true);

CREATE POLICY "products_modify_staff_only" ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 7. product_details 테이블 RLS 설정
ALTER TABLE public.product_details ENABLE ROW LEVEL SECURITY;

-- product_details 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "product_details_staff_all_operations" ON public.product_details;
DROP POLICY IF EXISTS "product_details_anon_read" ON public.product_details;
DROP POLICY IF EXISTS "product_details_staff_all" ON public.product_details;
DROP POLICY IF EXISTS "Enable all operations for authenticated users on product_details" ON public.product_details;
DROP POLICY IF EXISTS "Enable read access for all users on product_details" ON public.product_details;
DROP POLICY IF EXISTS "Enable write access for team members on product_details" ON public.product_details;
DROP POLICY IF EXISTS "Enable update access for team members on product_details" ON public.product_details;
DROP POLICY IF EXISTS "Enable delete access for team members on product_details" ON public.product_details;
DROP POLICY IF EXISTS "product_details_select_all" ON public.product_details;
DROP POLICY IF EXISTS "product_details_modify_staff_only" ON public.product_details;

-- product_details 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "product_details_select_all" ON public.product_details
  FOR SELECT
  USING (true);

CREATE POLICY "product_details_modify_staff_only" ON public.product_details
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 8. options 테이블 RLS 설정
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

-- options 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "options_select_all" ON public.options;
DROP POLICY IF EXISTS "options_modify_staff_only" ON public.options;
DROP POLICY IF EXISTS "options_insert_staff" ON public.options;
DROP POLICY IF EXISTS "options_update_staff" ON public.options;
DROP POLICY IF EXISTS "options_delete_staff" ON public.options;

-- options 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "options_select_all" ON public.options
  FOR SELECT
  USING (true);

CREATE POLICY "options_modify_staff_only" ON public.options
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 9. channels 테이블 RLS 설정
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- channels 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "channels_select_all" ON public.channels;
DROP POLICY IF EXISTS "channels_modify_staff_only" ON public.channels;
DROP POLICY IF EXISTS "channels_insert_staff" ON public.channels;
DROP POLICY IF EXISTS "channels_update_staff" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_staff" ON public.channels;

-- channels 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "channels_select_all" ON public.channels
  FOR SELECT
  USING (true);

CREATE POLICY "channels_modify_staff_only" ON public.channels
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 10. audit_logs 테이블 RLS 설정
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- audit_logs 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "audit_logs_select_staff_only" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_staff" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;

-- audit_logs 테이블: staff만 읽기 가능, 모든 인증된 사용자가 쓰기 가능
CREATE POLICY "audit_logs_select_staff_only" ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 11. attendance_records 테이블 RLS 설정
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- attendance_records 테이블 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Enable all access for attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_select_all" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_modify_staff_only" ON public.attendance_records;

-- attendance_records 테이블: staff는 모든 작업 가능, 고객은 읽기만
CREATE POLICY "attendance_records_select_all" ON public.attendance_records
  FOR SELECT
  USING (true);

CREATE POLICY "attendance_records_modify_staff_only" ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMIT;
