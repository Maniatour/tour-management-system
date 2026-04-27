-- SOP 본문을 섹션/카테고리/내용 JSON(body_structure)으로 저장

ALTER TABLE public.company_sop_versions
  ADD COLUMN IF NOT EXISTS body_structure jsonb;

ALTER TABLE public.company_sop_versions
  ALTER COLUMN body_md DROP NOT NULL;

UPDATE public.company_sop_versions
SET body_structure = jsonb_build_object(
  'sections',
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'title', '본문',
      'sort_order', 0,
      'categories',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'title', '내용',
          'sort_order', 0,
          'content', COALESCE(body_md, '')
        )
      )
    )
  )
)
WHERE body_structure IS NULL;

COMMENT ON COLUMN public.company_sop_versions.body_structure IS 'SOP 계층: sections[].categories[].content (JSON)';
