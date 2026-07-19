-- FAQ multilingual content (JSON) + ensure legacy EN columns exist.
-- Shape: { "question": { "ja": "...", "zh-CN": "..." }, "answer": { ... } }
-- ko/en dual-write to question / question_en / answer / answer_en.

alter table public.product_faqs
  add column if not exists question_en text,
  add column if not exists answer_en text,
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column public.product_faqs.content_i18n is
  'Per-locale FAQ text: { question: { locale: text }, answer: { locale: text } }';

-- Seed content_i18n from legacy columns
update public.product_faqs
set content_i18n = jsonb_strip_nulls(
  jsonb_build_object(
    'question',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(question), ''),
        'en', nullif(trim(coalesce(question_en, '')), '')
      )
    ),
    'answer',
    jsonb_strip_nulls(
      jsonb_build_object(
        'ko', nullif(trim(answer), ''),
        'en', nullif(trim(coalesce(answer_en, '')), '')
      )
    )
  )
)
where coalesce(content_i18n, '{}'::jsonb) = '{}'::jsonb
  and (
    nullif(trim(question), '') is not null
    or nullif(trim(coalesce(question_en, '')), '') is not null
    or nullif(trim(answer), '') is not null
    or nullif(trim(coalesce(answer_en, '')), '') is not null
  );
