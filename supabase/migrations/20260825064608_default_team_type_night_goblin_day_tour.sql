-- 밤도깨비·그랜드서클 당일 투어 기본 팀 구성: 2가이드
-- 1) 상품별 기본 team_type 산출
-- 2) 예약 INSERT 자동 투어 생성 시 적용 (기존에는 컬럼 기본값 1guide)
-- 3) 앞으로의(오늘 이후) 1가이드 투어를 2가이드로 보정

CREATE OR REPLACE FUNCTION public.default_team_type_for_product(p_product_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_name text;
  v_name_ko text;
  v_name_en text;
  v_internal_ko text;
  v_customer_ko text;
  v_joined_ko text;
  v_joined_en text;
BEGIN
  v_id := upper(trim(coalesce(p_product_id, '')));
  IF v_id LIKE 'MDGCSUNR%' OR v_id LIKE 'MDGC1D%' THEN
    RETURN '2guide';
  END IF;

  SELECT
    coalesce(name, ''),
    coalesce(name_ko, ''),
    coalesce(name_en, ''),
    coalesce(internal_name_ko, ''),
    coalesce(customer_name_ko, '')
  INTO v_name, v_name_ko, v_name_en, v_internal_ko, v_customer_ko
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN '1guide';
  END IF;

  v_joined_ko := concat_ws(' ', nullif(v_name, ''), nullif(v_name_ko, ''), nullif(v_internal_ko, ''), nullif(v_customer_ko, ''));
  v_joined_en := lower(concat_ws(' ', nullif(v_name_en, '')));

  IF v_joined_ko LIKE '%밤도깨비%'
     OR v_joined_en ~* 'night[[:space:]]*goblin'
     OR v_joined_en ~* 'midnight[[:space:]]*goblin' THEN
    RETURN '2guide';
  END IF;

  IF v_joined_ko LIKE '%당일 투어%' OR v_joined_ko LIKE '%당일투어%' THEN
    RETURN '2guide';
  END IF;

  IF (v_joined_ko LIKE '%그랜드서클%' OR v_joined_ko LIKE '%그랜드 서클%')
     AND v_joined_ko LIKE '%당일%' THEN
    RETURN '2guide';
  END IF;

  IF v_joined_en LIKE '%grand circle%'
     AND (v_joined_en LIKE '%day tour%' OR v_joined_en ~ '\mday trip\M')
     AND v_joined_en NOT LIKE '%night%' THEN
    RETURN '2guide';
  END IF;

  RETURN '1guide';
END;
$$;

COMMENT ON FUNCTION public.default_team_type_for_product(text) IS
  'Default tours.team_type for a product: 2guide for night goblin (MDGCSUNR*) and Grand Circle day tour (MDGC1D*).';

CREATE OR REPLACE FUNCTION public.auto_create_or_update_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_sub_category TEXT;
    existing_tour_id TEXT;
    new_tour_id TEXT;
    actor_email TEXT;
BEGIN
    actor_email := NULLIF(TRIM(COALESCE(current_setting('app.current_user_email', true), '')), '');
    IF actor_email IS NULL THEN
        actor_email := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
    END IF;
    IF actor_email IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT NULLIF(TRIM(u.email), '')
          INTO actor_email
          FROM auth.users u
         WHERE u.id = auth.uid();
    END IF;
    IF actor_email IS NULL THEN
        actor_email := NULLIF(TRIM(COALESCE(NEW.added_by, '')), '');
    END IF;

    IF actor_email IS NULL THEN
        PERFORM set_config('app.current_user_email', 'system', true);
        PERFORM set_config('app.audit_cause', 'auto_tour_assign', true);
    ELSE
        PERFORM set_config('app.current_user_email', actor_email, true);
        -- 사람이 트리거했지만 연쇄 투어 갱신임을 표시
        PERFORM set_config('app.audit_cause', 'auto_tour_assign', true);
    END IF;

    SELECT sub_category INTO product_sub_category
    FROM products
    WHERE id = NEW.product_id;

    IF product_sub_category IN ('Mania Tour', 'Mania Service') THEN
        SELECT id INTO existing_tour_id
        FROM tours
        WHERE product_id = NEW.product_id
          AND tour_date = NEW.tour_date
        LIMIT 1;

        IF existing_tour_id IS NOT NULL THEN
            UPDATE tours
            SET reservation_ids = CASE
                WHEN reservation_ids IS NOT NULL AND reservation_ids @> ARRAY[NEW.id::text] THEN reservation_ids
                WHEN reservation_ids IS NULL THEN ARRAY[NEW.id::text]
                ELSE array_append(reservation_ids, NEW.id::text)
            END
            WHERE id = existing_tour_id;

            UPDATE reservations
            SET tour_id = existing_tour_id
            WHERE id = NEW.id;
        ELSE
            INSERT INTO tours (
                product_id,
                tour_date,
                reservation_ids,
                tour_status,
                team_type
            ) VALUES (
                NEW.product_id,
                NEW.tour_date,
                ARRAY[NEW.id::text],
                'scheduled',
                public.default_team_type_for_product(NEW.product_id)
            ) RETURNING id INTO new_tour_id;

            UPDATE reservations
            SET tour_id = new_tour_id
            WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, auth;

COMMENT ON FUNCTION public.auto_create_or_update_tour() IS
  'Auto-assign reservation to tour; night goblin / Grand Circle day tours default to 2guide.';

UPDATE tours t
SET team_type = '2guide'
FROM products p
WHERE t.product_id = p.id
  AND t.tour_date >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date)
  AND lower(replace(coalesce(t.team_type, ''), ' ', '')) IN ('1guide', '1_guide')
  AND coalesce(t.tour_status, '') NOT IN (
    'Deleted',
    'Canceled - Event Closed',
    'Canceled - No Minimum',
    'Cancelled',
    'Canceled'
  )
  AND (
    t.product_id ILIKE 'MDGCSUNR%'
    OR t.product_id ILIKE 'MDGC1D%'
    OR coalesce(p.name, '') ILIKE '%밤도깨비%'
    OR coalesce(p.name_ko, '') ILIKE '%밤도깨비%'
    OR coalesce(p.name, '') ILIKE '%당일 투어%'
    OR coalesce(p.name_ko, '') ILIKE '%당일 투어%'
    OR (
      (coalesce(p.name_ko, '') ILIKE '%그랜드서클%' OR coalesce(p.name_ko, '') ILIKE '%그랜드 서클%')
      AND coalesce(p.name_ko, '') ILIKE '%당일%'
    )
  );
