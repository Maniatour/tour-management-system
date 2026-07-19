-- Multilingual content for choice templates stored in public.options.
-- Shape:
-- {
--   "name": { "ko": "...", "en": "...", "ja": "..." },
--   "description": { ... },
--   "group_name": { ... },
--   "group_description": { ... }
-- }
-- Dual-write ko/en into legacy scalar columns.

alter table public.options
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column public.options.content_i18n is
  'Per-locale option/group text for choice templates: { name, description, group_name, group_description }';

update public.options
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'name',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(name_ko, '')), ''),
        'en', nullif(trim(coalesce(name_en, name, '')), '')
      )
    ),
    'description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(description_ko, '')), ''),
        'en', nullif(trim(coalesce(description_en, description, '')), '')
      )
    ),
    'group_name',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(template_group_ko, '')), ''),
        'en', nullif(trim(coalesce(template_group, '')), '')
      )
    ),
    'group_description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(template_group_description_ko, '')), ''),
        'en', nullif(trim(coalesce(template_group_description_en, '')), '')
      )
    )
  )
)
where coalesce(is_choice_template, false) = true
  and coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb;
