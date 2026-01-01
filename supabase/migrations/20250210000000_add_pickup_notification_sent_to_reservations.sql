-- reservations 테이블에 pickup_notification_sent 컬럼 추가
-- 픽업 스케줄 확정 안내를 보냈는지 기록
-- 작성일: 2025-02-10

-- reservations 테이블에 pickup_notification_sent 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'pickup_notification_sent'
  ) THEN
    ALTER TABLE reservations 
    ADD COLUMN pickup_notification_sent BOOLEAN DEFAULT FALSE;
    
    -- 주석 추가
    COMMENT ON COLUMN reservations.pickup_notification_sent IS '픽업 스케줄 확정 안내 이메일 발송 여부';
  END IF;
END $$;

