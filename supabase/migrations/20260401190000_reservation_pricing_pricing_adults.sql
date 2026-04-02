-- 청구/상품가 계산용 성인 인원 (예약 reservations.adults 와 별도)
ALTER TABLE public.reservation_pricing
  ADD COLUMN IF NOT EXISTS pricing_adults integer;

COMMENT ON COLUMN public.reservation_pricing.pricing_adults IS
  '상품가·필수옵션 등 가격 계산에 쓰는 성인 수. NULL이면 예약의 adults와 동일하게 간주(레거시).';
