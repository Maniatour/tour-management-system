-- Tips 쉐어 시 카드 수수료 공제 여부: Wix Website, Square Invoice 등은 true, K Bank, Wells Fargo 등은 false
-- Migration: 20260201000000_add_deduct_card_fee_for_tips_to_payment_methods

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS deduct_card_fee_for_tips BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN payment_methods.deduct_card_fee_for_tips IS 'Tips 쉐어 시 카드 수수료를 공제할지 여부. true: Wix Website, Square Invoice 등 온라인/카드 결제, false: K Bank, Wells Fargo 등 계좌이체/무수수료';
