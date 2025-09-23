-- payment_records 테이블 RLS 정책 설정

-- RLS 활성화
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 입금 내역 조회/수정 가능
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

-- 업데이트 시 updated_at 자동 갱신 함수 (이미 있다면 무시)
CREATE OR REPLACE FUNCTION public.update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성 (이미 있다면 무시)
DROP TRIGGER IF EXISTS trigger_update_payment_records_updated_at ON public.payment_records;
CREATE TRIGGER trigger_update_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_records_updated_at();
