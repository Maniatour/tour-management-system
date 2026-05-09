-- 예약 가격 ④ 최종 매출·운영이익 DB 스냅샷 컬럼
-- 기존 행 값은 `scripts/backfill-reservation-pricing-revenue.mjs` 로 채우거나, 예약 저장 시 자동 갱신됩니다.

ALTER TABLE reservation_pricing
  ADD COLUMN IF NOT EXISTS company_total_revenue numeric(12, 2),
  ADD COLUMN IF NOT EXISTS operating_profit numeric(12, 2);

COMMENT ON COLUMN reservation_pricing.company_total_revenue IS
  '가격 정보 ④ 최종 매출(총 매출) — 저장 시점 스냅샷';
COMMENT ON COLUMN reservation_pricing.operating_profit IS
  '가격 정보 ④ 운영이익(최종 매출 − 선결제 팁) — 저장 시점 스냅샷';
