-- Persist editable section titles for product detail sections.
-- Used by admin product details editor (channel/variant specific and common details).

ALTER TABLE public.product_details_multilingual
ADD COLUMN IF NOT EXISTS section_titles JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.product_details_common_multilingual
ADD COLUMN IF NOT EXISTS section_titles JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.product_details_multilingual.section_titles IS
'Per-section display title overrides as JSON (e.g. {"description":"📝 Description"}).';

COMMENT ON COLUMN public.product_details_common_multilingual.section_titles IS
'Per-section display title overrides for common product details.';

