-- Short reusable UI labels for content library (section headers, etc.)
-- Editable in admin; falls back to code defaults when missing.

create table if not exists public.content_library_ui_labels (
  key text primary key,
  name text not null default '',
  content_i18n jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_library_ui_labels is
  'Short multilingual UI labels for reusable content library (e.g. tour audience section titles)';

alter table public.content_library_ui_labels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_library_ui_labels'
      and policyname = 'content_library_ui_labels_select_all'
  ) then
    create policy content_library_ui_labels_select_all
      on public.content_library_ui_labels
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_library_ui_labels'
      and policyname = 'content_library_ui_labels_write_authenticated'
  ) then
    create policy content_library_ui_labels_write_authenticated
      on public.content_library_ui_labels
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into public.content_library_ui_labels (key, name, content_i18n) values
(
  'tour_audience.recommended',
  '추천 대상 - 추천',
  jsonb_build_object(
    'label', jsonb_build_object(
      'ko', '추천',
      'en', 'Recommended for',
      'ja', 'おすすめ',
      'zh-CN', '推荐对象',
      'zh-TW', '推薦對象',
      'es', 'Recomendado para',
      'fr', 'Recommandé pour',
      'de', 'Empfohlen für'
    )
  )
),
(
  'tour_audience.not_recommended',
  '추천 대상 - 비추천',
  jsonb_build_object(
    'label', jsonb_build_object(
      'ko', '추천하지 않는 분',
      'en', 'Not recommended for',
      'ja', 'おすすめしない方',
      'zh-CN', '不推荐对象',
      'zh-TW', '不推薦對象',
      'es', 'No recomendado para',
      'fr', 'Non recommandé pour',
      'de', 'Nicht empfohlen für'
    )
  )
)
on conflict (key) do update
set
  name = excluded.name,
  content_i18n = excluded.content_i18n,
  updated_at = now();
