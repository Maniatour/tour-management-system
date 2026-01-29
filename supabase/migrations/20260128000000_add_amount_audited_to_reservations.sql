-- reservations 테이블에 금액 Audit(더블체크) 컬럼 추가
-- Net Price와 OTA 실제 입금액 일치 여부 확인 후 기록
-- 작성일: 2026-01-28

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'amount_audited'
  ) THEN
    ALTER TABLE reservations
    ADD COLUMN amount_audited BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN reservations.amount_audited IS '금액 더블체크(Audit) 완료 여부';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'amount_audited_at'
  ) THEN
    ALTER TABLE reservations
    ADD COLUMN amount_audited_at TIMESTAMPTZ;

    COMMENT ON COLUMN reservations.amount_audited_at IS '금액 Audit 수행 일시';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'amount_audited_by'
  ) THEN
    ALTER TABLE reservations
    ADD COLUMN amount_audited_by TEXT;

    COMMENT ON COLUMN reservations.amount_audited_by IS '금액 Audit 수행자 (이메일)';
  END IF;
END $$;
