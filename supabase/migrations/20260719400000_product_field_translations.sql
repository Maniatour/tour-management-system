-- Product field translations (EAV): one row per product + field_key + locale.
-- Legacy products.*_ko / *_en columns remain dual-written for ko/en.

create table if not exists public.product_field_translations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  field_key text not null,
  locale text not null,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_field_translations_field_key_nonempty check (char_length(trim(field_key)) > 0),
  constraint product_field_translations_locale_nonempty check (char_length(trim(locale)) > 0),
  constraint product_field_translations_unique unique (product_id, field_key, locale)
);

create index if not exists product_field_translations_product_id_idx
  on public.product_field_translations (product_id);

create index if not exists product_field_translations_locale_idx
  on public.product_field_translations (locale);

comment on table public.product_field_translations is
  'Multilingual product scalar fields (customer_name, summary, cities, etc.).';

comment on column public.product_field_translations.field_key is
  'Logical field: customer_name, summary, name, departure_city, arrival_city, departure_country, arrival_country, ...';

-- Backfill ko/en from legacy columns
insert into public.product_field_translations (product_id, field_key, locale, value)
select p.id, v.field_key, v.locale, v.value
from public.products p
cross join lateral (
  values
    ('name', 'ko', coalesce(nullif(trim(p.name), ''), nullif(trim(p.name_ko), ''), '')),
    ('name', 'en', coalesce(nullif(trim(p.name_en), ''), '')),
    ('customer_name', 'ko', coalesce(nullif(trim(p.customer_name_ko), ''), nullif(trim(p.name), ''), '')),
    ('customer_name', 'en', coalesce(nullif(trim(p.customer_name_en), ''), nullif(trim(p.name_en), ''), '')),
    ('summary', 'ko', coalesce(nullif(trim(p.summary_ko), ''), '')),
    ('summary', 'en', coalesce(nullif(trim(p.summary_en), ''), '')),
    ('departure_city', 'ko', coalesce(nullif(trim(p.departure_city_ko), ''), nullif(trim(p.departure_city), ''), '')),
    ('departure_city', 'en', coalesce(nullif(trim(p.departure_city_en), ''), '')),
    ('arrival_city', 'ko', coalesce(nullif(trim(p.arrival_city_ko), ''), nullif(trim(p.arrival_city), ''), '')),
    ('arrival_city', 'en', coalesce(nullif(trim(p.arrival_city_en), ''), '')),
    ('departure_country', 'ko', coalesce(nullif(trim(p.departure_country_ko), ''), nullif(trim(p.departure_country), ''), '')),
    ('departure_country', 'en', coalesce(nullif(trim(p.departure_country_en), ''), '')),
    ('arrival_country', 'ko', coalesce(nullif(trim(p.arrival_country_ko), ''), nullif(trim(p.arrival_country), ''), '')),
    ('arrival_country', 'en', coalesce(nullif(trim(p.arrival_country_en), ''), ''))
) as v(field_key, locale, value)
where nullif(trim(v.value), '') is not null
on conflict (product_id, field_key, locale) do nothing;

alter table public.product_field_translations enable row level security;

revoke all on table public.product_field_translations from anon;
grant select on table public.product_field_translations to anon;
grant select, insert, update, delete on table public.product_field_translations to authenticated;

drop policy if exists "product_field_translations_select_anon" on public.product_field_translations;
drop policy if exists "product_field_translations_select_team" on public.product_field_translations;
drop policy if exists "product_field_translations_insert_staff" on public.product_field_translations;
drop policy if exists "product_field_translations_update_staff" on public.product_field_translations;
drop policy if exists "product_field_translations_delete_staff" on public.product_field_translations;

create policy "product_field_translations_select_anon"
  on public.product_field_translations for select to anon
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_field_translations.product_id
        and coalesce(p.is_published, true) = true
    )
  );

create policy "product_field_translations_select_team"
  on public.product_field_translations for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_field_translations_insert_staff"
  on public.product_field_translations for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_field_translations_update_staff"
  on public.product_field_translations for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_field_translations_delete_staff"
  on public.product_field_translations for delete to authenticated
  using (public.is_staff(public.current_email()));
