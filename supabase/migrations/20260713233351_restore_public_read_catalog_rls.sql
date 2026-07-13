-- Restore anon/authenticated SELECT on customer-facing catalog CMS tables.
-- 20260713250000 replaced permissive policies with admin/staff FOR ALL only,
-- which blocked public product tags, translations, and category labels.

begin;

-- tags / tag_translations — product badges on customer pages
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tags'
  ) then
    drop policy if exists "tags_public_select" on public.tags;
    create policy "tags_public_select"
      on public.tags for select
      to anon, authenticated
      using (true);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tag_translations'
  ) then
    drop policy if exists "tag_translations_public_select" on public.tag_translations;
    create policy "tag_translations_public_select"
      on public.tag_translations for select
      to anon, authenticated
      using (true);
  end if;
end$$;

-- translations / translation_values — customer page CMS content
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'translations'
  ) then
    drop policy if exists "translations_public_select" on public.translations;
    create policy "translations_public_select"
      on public.translations for select
      to anon, authenticated
      using (true);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'translation_values'
  ) then
    drop policy if exists "translation_values_public_select" on public.translation_values;
    create policy "translation_values_public_select"
      on public.translation_values for select
      to anon, authenticated
      using (true);
  end if;
end$$;

-- product categories — customer product filters / embeds
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_categories'
  ) then
    drop policy if exists "product_categories_public_select" on public.product_categories;
    create policy "product_categories_public_select"
      on public.product_categories for select
      to anon, authenticated
      using (true);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_sub_categories'
  ) then
    drop policy if exists "product_sub_categories_public_select" on public.product_sub_categories;
    create policy "product_sub_categories_public_select"
      on public.product_sub_categories for select
      to anon, authenticated
      using (true);
  end if;
end$$;

-- tour course catalog (customer itinerary display) — team write remains
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_categories'
  ) then
    drop policy if exists "tour_course_categories_public_select" on public.tour_course_categories;
    create policy "tour_course_categories_public_select"
      on public.tour_course_categories for select
      to anon, authenticated
      using (true);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tour_course_points'
  ) then
    drop policy if exists "tour_course_points_public_select" on public.tour_course_points;
    create policy "tour_course_points_public_select"
      on public.tour_course_points for select
      to anon, authenticated
      using (true);
  end if;
end$$;

commit;
