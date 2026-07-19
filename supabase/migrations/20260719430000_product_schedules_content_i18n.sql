-- Multilingual content for product schedule items (JSON).
-- Shape: { "title": { "ja": "..." }, "description": { "zh-CN": "..." }, "location": { "es": "..." } }
-- Dual-write ko/en into legacy columns.

alter table public.product_schedules
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column public.product_schedules.content_i18n is
  'Per-locale schedule text: { title, description, location }';

update public.product_schedules
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'title',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(title_ko, '')), ''),
        'en', nullif(trim(coalesce(title_en, '')), '')
      )
    ),
    'description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(description_ko, '')), ''),
        'en', nullif(trim(coalesce(description_en, '')), '')
      )
    ),
    'location',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(location_ko, '')), ''),
        'en', nullif(trim(coalesce(location_en, '')), '')
      )
    )
  )
)
where coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb;
