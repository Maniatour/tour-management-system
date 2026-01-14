-- payment_methods 테이블의 user_email을 nullable로 변경
-- 고객 결제 내역에서도 사용할 수 있도록 함
-- Migration: 20250203000001_make_payment_methods_user_email_nullable

begin;

-- user_email을 nullable로 변경
ALTER TABLE payment_methods 
  ALTER COLUMN user_email DROP NOT NULL;

-- user_email이 null인 경우를 위한 인덱스 추가 (고객용 결제 방법 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_email_null ON payment_methods(user_email) 
  WHERE user_email IS NULL;

-- 사용 목적을 구분하기 위한 주석 추가
COMMENT ON COLUMN payment_methods.user_email IS 
  '직원 이메일 (직원용 결제 방법) 또는 NULL (고객용 결제 방법)';

commit;
