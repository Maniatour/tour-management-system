-- MSPICKUP3/6/14 → MSFPICKUP, MSSENDING3/6/14 → MSSENDING 상품 ID 통합
-- Supabase SQL Editor(문장 분리 실행) 호환: 단일 DO 블록, 매핑 테이블 없음

DO $migration$
DECLARE
  r RECORD;
  merge_values TEXT := $map$
    (VALUES
      ('MSPICKUP3'::text,  'MSFPICKUP'::text, '3'::text),
      ('MSPICKUP6'::text,  'MSFPICKUP'::text, '6'::text),
      ('MSPICKUP14'::text, 'MSFPICKUP'::text, '14'::text),
      ('MSSENDING3'::text,  'MSSENDING'::text, '3'::text),
      ('MSSENDING6'::text,  'MSSENDING'::text, '6'::text),
      ('MSSENDING14'::text, 'MSSENDING'::text, '14'::text)
    )
  $map$;
  merge_from TEXT := merge_values || ' AS m(old_id, new_id, variant_suffix)';
  old_ids TEXT[] := ARRAY[
    'MSPICKUP3', 'MSPICKUP6', 'MSPICKUP14',
    'MSSENDING3', 'MSSENDING6', 'MSSENDING14'
  ];
  tbl TEXT;
  skip_tables TEXT[] := ARRAY[
    'products',
    'products_backup_20260626_pickup_sending_merge',
    'product_id_mapping_suggestions',
    'products_choices_backup'
  ];
BEGIN
  DROP TABLE IF EXISTS public._product_id_merge;

  -- 백업 (재실행 시 스킵)
  IF to_regclass('public.products_backup_20260626_pickup_sending_merge') IS NULL THEN
    EXECUTE $q$
      CREATE TABLE public.products_backup_20260626_pickup_sending_merge AS
      SELECT p.*, NOW() AS backed_up_at
      FROM products p
      WHERE p.id = ANY ($1::text[])
         OR p.id IN ('MSFPICKUP', 'MSSENDING')
    $q$ USING old_ids;
  END IF;

  -- canonical products (14 → 6 → 3 우선)
  INSERT INTO products (
    id, name, name_en, name_ko, category, description, base_price, status,
    product_code, sub_category, summary_en, summary_ko, tags, duration, group_size,
    adult_age, child_age_min, child_age_max, infant_age,
    adult_base_price, child_base_price, infant_base_price,
    departure_city, departure_country, arrival_city, arrival_country,
    languages, transportation_methods, max_participants, tour_departure_times,
    homepage_pricing_type, display_name, customer_name_en, customer_name_ko,
    choices, is_favorite, favorite_order, use_common_details, created_at
  )
  SELECT
    pick.new_id,
    p.name, p.name_en, p.name_ko, p.category, p.description, p.base_price, p.status,
    p.product_code, p.sub_category, p.summary_en, p.summary_ko, p.tags, p.duration, p.group_size,
    p.adult_age, p.child_age_min, p.child_age_max, p.infant_age,
    p.adult_base_price, p.child_base_price, p.infant_base_price,
    p.departure_city, p.departure_country, p.arrival_city, p.arrival_country,
    p.languages, p.transportation_methods, p.max_participants, p.tour_departure_times,
    p.homepage_pricing_type, p.display_name, p.customer_name_en, p.customer_name_ko,
    p.choices, p.is_favorite, p.favorite_order, p.use_common_details, p.created_at
  FROM (
    SELECT DISTINCT ON (m.new_id) m.new_id, m.old_id
    FROM (VALUES
      ('MSPICKUP3',  'MSFPICKUP', 3),
      ('MSPICKUP6',  'MSFPICKUP', 6),
      ('MSPICKUP14', 'MSFPICKUP', 14),
      ('MSSENDING3',  'MSSENDING', 3),
      ('MSSENDING6',  'MSSENDING', 6),
      ('MSSENDING14', 'MSSENDING', 14)
    ) AS m(old_id, new_id, prio)
    ORDER BY m.new_id, m.prio DESC
  ) pick
  JOIN products p ON p.id = pick.old_id
  ON CONFLICT (id) DO NOTHING;

  -- variant_key: default 계열만 접미사로
  FOREACH tbl IN ARRAY ARRAY[
    'channel_products',
    'dynamic_pricing',
    'reservations',
    'product_details_multilingual'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'variant_key'
    ) THEN
      EXECUTE format(
        $q$
        UPDATE %1$I t
        SET variant_key = m.variant_suffix
        FROM %2$s
        WHERE t.product_id = m.old_id
          AND t.variant_key IN ('default', '', 'standard')
        $q$,
        tbl,
        merge_from
      );
    END IF;
  END LOOP;

  -- product_schedules 충돌 스케줄 삭제
  EXECUTE format($q$
    DELETE FROM product_schedules ps
    USING %s
    WHERE ps.product_id = m.old_id
      AND EXISTS (
        SELECT 1 FROM product_schedules existing
        WHERE existing.product_id = m.new_id AND existing.day_number = ps.day_number
      )
  $q$, merge_from);

  -- product_details
  EXECUTE format($q$
    UPDATE product_details pd
    SET product_id = m.new_id
    FROM %s
    WHERE pd.product_id = m.old_id
      AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = m.new_id)
  $q$, merge_from);

  EXECUTE format($q$
    DELETE FROM product_details pd USING %s WHERE pd.product_id = m.old_id
  $q$, merge_from);

  -- product_details_multilingual 사전 충돌 제거
  EXECUTE format($q$
    DELETE FROM product_details_multilingual dup
    USING product_details_multilingual keep, %s
    WHERE dup.product_id = m.old_id
      AND keep.product_id = m.new_id
      AND dup.language_code = keep.language_code
      AND COALESCE(dup.channel_id, '') = COALESCE(keep.channel_id, '')
      AND dup.variant_key = keep.variant_key
  $q$, merge_from);

  -- product_options product_id 이전
  EXECUTE format($q$
    UPDATE product_options po SET product_id = m.new_id FROM %s WHERE po.product_id = m.old_id
  $q$, merge_from);

  DELETE FROM product_options dup
  USING product_options keep
  WHERE dup.product_id IN ('MSFPICKUP', 'MSSENDING')
    AND keep.product_id = dup.product_id
    AND dup.name = keep.name
    AND dup.id::text > keep.id::text;

  -- 모든 product_id 컬럼 테이블 일괄 갱신
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'product_id'
      AND t.table_type = 'BASE TABLE'
      AND c.udt_name IN ('text', 'varchar', 'bpchar')
    ORDER BY c.table_name
  LOOP
    IF r.table_name = ANY (skip_tables) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      $q$ UPDATE %1$I t SET product_id = m.new_id FROM %2$s WHERE t.product_id = m.old_id $q$,
      r.table_name,
      merge_from
    );
  END LOOP;

  -- 중복 제거
  DELETE FROM channel_products dup
  USING channel_products keep
  WHERE dup.product_id IN ('MSFPICKUP', 'MSSENDING')
    AND keep.product_id = dup.product_id
    AND dup.channel_id = keep.channel_id
    AND dup.variant_key = keep.variant_key
    AND dup.id::text > keep.id::text;

  DELETE FROM dynamic_pricing dup
  USING dynamic_pricing keep
  WHERE dup.product_id IN ('MSFPICKUP', 'MSSENDING')
    AND keep.product_id = dup.product_id
    AND dup.channel_id = keep.channel_id
    AND dup.date = keep.date
    AND dup.price_type = keep.price_type
    AND dup.variant_key = keep.variant_key
    AND dup.id::text > keep.id::text;

  DELETE FROM product_details_multilingual dup
  USING product_details_multilingual keep
  WHERE dup.product_id IN ('MSFPICKUP', 'MSSENDING')
    AND keep.product_id = dup.product_id
    AND dup.language_code = keep.language_code
    AND COALESCE(dup.channel_id, '') = COALESCE(keep.channel_id, '')
    AND dup.variant_key = keep.variant_key
    AND dup.id::text > keep.id::text;

  -- selected_product_id
  EXECUTE format($q$
    UPDATE tour_cost_calculator_configs tcc
    SET selected_product_id = m.new_id
    FROM %s
    WHERE tcc.selected_product_id = m.old_id
  $q$, merge_from);

  -- reservation_imports JSON
  EXECUTE format($q$
    UPDATE reservation_imports ri
    SET extracted_data = jsonb_set(
      COALESCE(ri.extracted_data, '{}'::jsonb),
      '{product_id}',
      to_jsonb(m.new_id::text),
      true
    )
    FROM %s
    WHERE ri.extracted_data->>'product_id' = m.old_id
  $q$, merge_from);

  DELETE FROM product_id_mapping_suggestions
  WHERE old_product_id = ANY (old_ids)
     OR suggested_new_product_id = ANY (old_ids);

  INSERT INTO product_id_mapping_suggestions (old_product_id, suggested_new_product_id, reservation_count)
  SELECT m.old_id, m.new_id, 0
  FROM (VALUES
    ('MSPICKUP3',  'MSFPICKUP'),
    ('MSPICKUP6',  'MSFPICKUP'),
    ('MSPICKUP14', 'MSFPICKUP'),
    ('MSSENDING3',  'MSSENDING'),
    ('MSSENDING6',  'MSSENDING'),
    ('MSSENDING14', 'MSSENDING')
  ) AS m(old_id, new_id)
  ON CONFLICT (old_product_id) DO UPDATE
  SET suggested_new_product_id = EXCLUDED.suggested_new_product_id;

  DELETE FROM products p WHERE p.id = ANY (old_ids);

  RAISE NOTICE 'MS pickup/sending product_id merge completed.';
END
$migration$;

-- 검증
-- SELECT id FROM products WHERE id = ANY(ARRAY['MSPICKUP3','MSPICKUP6','MSPICKUP14','MSSENDING3','MSSENDING6','MSSENDING14']);
-- SELECT product_id, COUNT(*) FROM reservations WHERE product_id LIKE 'MS%' GROUP BY 1;
