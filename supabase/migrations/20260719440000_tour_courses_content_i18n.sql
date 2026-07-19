-- Multilingual customer-facing text for tour courses (JSON).
-- Shape: { "name": { "ja": "..." }, "description": { "zh-CN": "..." } }
-- Dual-write ko/en into legacy customer_* columns.

alter table public.tour_courses
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column public.tour_courses.content_i18n is
  'Per-locale customer tour course text: { name, description }';

update public.tour_courses
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'name',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(customer_name_ko, '')), ''),
        'en', nullif(trim(coalesce(customer_name_en, '')), '')
      )
    ),
    'description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(customer_description_ko, '')), ''),
        'en', nullif(trim(coalesce(customer_description_en, '')), '')
      )
    )
  )
)
where coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb;
