-- Multilingual content for choice groups and options (JSON).
-- Shape: { "name": { "ja": "..." }, "description": { "zh-CN": "..." } }
-- Dual-write ko/en into legacy columns.

alter table public.product_choices
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

alter table public.choice_options
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column public.product_choices.content_i18n is
  'Per-locale choice group text: { name, description }';
comment on column public.choice_options.content_i18n is
  'Per-locale option text: { name, description }';

update public.product_choices
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'name',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(choice_group_ko), ''),
        'en', nullif(trim(coalesce(choice_group_en, '')), '')
      )
    ),
    'description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(description_ko, '')), ''),
        'en', nullif(trim(coalesce(description_en, '')), '')
      )
    )
  )
)
where coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb;

update public.choice_options
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'name',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(option_name_ko), ''),
        'en', nullif(trim(option_name), '')
      )
    ),
    'description',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(coalesce(description_ko, '')), ''),
        'en', nullif(trim(coalesce(description, '')), '')
      )
    )
  )
)
where coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb;
