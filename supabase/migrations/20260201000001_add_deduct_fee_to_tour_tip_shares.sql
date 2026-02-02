-- 수수료 차감 여부 저장 (Tips 쉐어 시 5% 차감 체크박스)
-- Migration: 20260201000001_add_deduct_fee_to_tour_tip_shares

ALTER TABLE tour_tip_shares
ADD COLUMN IF NOT EXISTS deduct_fee BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN tour_tip_shares.deduct_fee IS '수수료 차감 적용 여부. true면 쉐어할 tips에 5% 수수료 차감 적용';
