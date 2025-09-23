-- payment_records 테이블 완전 설정 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 테이블이 존재하는지 확인하고 없으면 생성
CREATE TABLE IF NOT EXISTS public.payment_records (
  id text NOT NULL DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL,
  payment_status character varying(50) NOT NULL DEFAULT 'pending'::character varying,
  amount numeric(10, 2) NOT NULL,
  payment_method character varying(50) NOT NULL,
  note text NULL,
  image_file_url text NULL,
  submit_on timestamp with time zone NULL DEFAULT now(),
  submit_by character varying(255) NULL,
  confirmed_on timestamp with time zone NULL,
  confirmed_by character varying(255) NULL,
  amount_krw numeric(10, 2) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT payment_records_pkey PRIMARY KEY (id),
  CONSTRAINT payment_records_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payment_records_reservation_id ON public.payment_records USING btree (reservation_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_status ON public.payment_records USING btree (payment_status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_payment_records_submit_on ON public.payment_records USING btree (submit_on) TABLESPACE pg_default;

-- 3. 업데이트 함수 생성
CREATE OR REPLACE FUNCTION public.update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_payment_records_updated_at ON public.payment_records;
CREATE TRIGGER trigger_update_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_records_updated_at();

-- 5. RLS 활성화
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책 생성 (기존 정책이 있다면 삭제 후 재생성)
DROP POLICY IF EXISTS "Admins can view all payment records" ON public.payment_records;
DROP POLICY IF EXISTS "Admins can insert payment records" ON public.payment_records;
DROP POLICY IF EXISTS "Admins can update payment records" ON public.payment_records;
DROP POLICY IF EXISTS "Admins can delete payment records" ON public.payment_records;

CREATE POLICY "Admins can view all payment records" ON public.payment_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can insert payment records" ON public.payment_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can update payment records" ON public.payment_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can delete payment records" ON public.payment_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 7. Real-time 동기화 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;

-- 8. 필요한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 9. 설정 확인
SELECT 'Table created successfully' as status;
SELECT 'RLS enabled' as rls_status;
SELECT 'Real-time enabled' as realtime_status;

-- 10. 테이블 정보 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename = 'payment_records';

-- 11. Real-time publication 확인
SELECT 
  p.pubname,
  c.relname as table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
AND c.relname = 'payment_records';
