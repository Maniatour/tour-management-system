-- 예약 카드 뱃지 등에 표시할 초이스 옵션 내부용 짧은 이름
ALTER TABLE public.choice_options
  ADD COLUMN IF NOT EXISTS internal_name text;

COMMENT ON COLUMN public.choice_options.internal_name IS '예약 카드 뱃지 등 내부 표시용 짧은 이름 (예: 🏜️ X, 🏜️ L)';
