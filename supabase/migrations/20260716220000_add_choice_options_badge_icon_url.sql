-- 예약 카드 등 내부 뱃지용 아이콘 이미지 URL
ALTER TABLE public.choice_options
  ADD COLUMN IF NOT EXISTS badge_icon_url text;

COMMENT ON COLUMN public.choice_options.badge_icon_url IS '예약 카드 등 내부 뱃지용 아이콘 이미지 URL';
