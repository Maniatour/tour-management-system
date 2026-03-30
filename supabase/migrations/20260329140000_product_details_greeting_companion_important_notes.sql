-- 고객 노출용 추가 섹션: 인사말, 동행모집 안내, IMPORTANT NOTES
ALTER TABLE public.product_details_multilingual ADD COLUMN IF NOT EXISTS greeting TEXT;
ALTER TABLE public.product_details_multilingual ADD COLUMN IF NOT EXISTS companion_recruitment_info TEXT;
ALTER TABLE public.product_details_multilingual ADD COLUMN IF NOT EXISTS important_notes TEXT;

COMMENT ON COLUMN public.product_details_multilingual.greeting IS '고객 노출 인사말';
COMMENT ON COLUMN public.product_details_multilingual.companion_recruitment_info IS '동행모집 안내';
COMMENT ON COLUMN public.product_details_multilingual.important_notes IS 'IMPORTANT NOTES 등 강조 안내';
