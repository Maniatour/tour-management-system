-- 기존 JSONB choices 데이터를 새로운 간결한 구조로 마이그레이션
-- create_simple_choices_system.sql 실행 후 사용

-- 1. 기존 choices 데이터 백업
CREATE TABLE IF NOT EXISTS products_choices_backup AS
SELECT id, choices, created_at
FROM products
WHERE choices IS NOT NULL;

CREATE TABLE IF NOT EXISTS reservations_choices_backup AS
SELECT id, choices, created_at
FROM reservations
WHERE choices IS NOT NULL;

-- 2. 기존 JSONB choices를 새로운 구조로 변환하는 함수
CREATE OR REPLACE FUNCTION migrate_existing_choices_to_simple()
RETURNS TABLE(
  product_id TEXT,
  migrated_choices INTEGER,
  migrated_options INTEGER
) AS $$
DECLARE
  product_record RECORD;
  choice_item JSONB;
  choice_option JSONB;
  new_choice_id UUID;
  new_option_id UUID;
  choices_count INTEGER := 0;
  options_count INTEGER := 0;
  current_product_id TEXT;
  choice_group_name TEXT;
  option_key_name TEXT;
BEGIN
  -- 모든 상품의 choices 데이터 처리
  FOR product_record IN
    SELECT id, choices
    FROM products
    WHERE choices IS NOT NULL
  LOOP
    current_product_id := product_record.id;
    
    -- required choices 처리
    IF product_record.choices ? 'required' AND jsonb_typeof(product_record.choices->'required') = 'array' THEN
      FOR choice_item IN SELECT * FROM jsonb_array_elements(product_record.choices->'required')
      LOOP
        choice_group_name := COALESCE(choice_item->>'id', 'default_choice');
        
        -- choice 그룹 생성
        INSERT INTO product_choices (
          product_id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order
        ) VALUES (
          current_product_id,
          choice_group_name,
          COALESCE(choice_item->>'name_ko', choice_item->>'name', '기본 선택'),
          CASE 
            WHEN choice_item->>'type' = 'multiple_quantity' THEN 'quantity'
            WHEN choice_item->>'type' = 'single' THEN 'single'
            ELSE 'single'
          END,
          true, -- required는 모두 필수
          COALESCE((choice_item->'validation'->>'min_selections')::INTEGER, 1),
          COALESCE((choice_item->'validation'->>'max_selections')::INTEGER, 10),
          0
        )
        ON CONFLICT (product_id, choice_group) DO NOTHING
        RETURNING id INTO new_choice_id;
        
        -- choice_id가 없으면 기존 것 찾기
        IF new_choice_id IS NULL THEN
          SELECT id INTO new_choice_id
          FROM product_choices
          WHERE product_choices.product_id = current_product_id 
          AND product_choices.choice_group = choice_group_name;
        END IF;
        
        choices_count := choices_count + 1;
        
        -- options 처리
        IF choice_item ? 'options' AND jsonb_typeof(choice_item->'options') = 'array' THEN
          FOR choice_option IN SELECT * FROM jsonb_array_elements(choice_item->'options')
          LOOP
            INSERT INTO choice_options (
              choice_id,
              option_key,
              option_name,
              option_name_ko,
              adult_price,
              child_price,
              infant_price,
              capacity,
              is_default,
              is_active,
              sort_order
            ) VALUES (
              new_choice_id,
              COALESCE(choice_option->>'id', 'default_option'),
              COALESCE(choice_option->>'name', '기본 옵션'),
              COALESCE(choice_option->>'name_ko', choice_option->>'name', '기본 옵션'),
              COALESCE((choice_option->>'adult_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'child_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'infant_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'capacity_per_room')::INTEGER, 1),
              COALESCE((choice_option->>'is_default')::BOOLEAN, false),
              true,
              0
            )
            ON CONFLICT (choice_id, option_key) DO NOTHING;
            
            options_count := options_count + 1;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
    
    -- optional choices 처리 (있다면)
    IF product_record.choices ? 'optional' AND jsonb_typeof(product_record.choices->'optional') = 'array' THEN
      FOR choice_item IN SELECT * FROM jsonb_array_elements(product_record.choices->'optional')
      LOOP
        -- choice 그룹 생성 (optional)
        INSERT INTO product_choices (
          product_id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order
        ) VALUES (
          current_product_id,
          COALESCE(choice_item->>'id', 'optional_choice'),
          COALESCE(choice_item->>'name_ko', choice_item->>'name', '추가 선택'),
          CASE 
            WHEN choice_item->>'type' = 'multiple_quantity' THEN 'quantity'
            WHEN choice_item->>'type' = 'single' THEN 'single'
            ELSE 'single'
          END,
          false, -- optional은 선택사항
          COALESCE((choice_item->'validation'->>'min_selections')::INTEGER, 0),
          COALESCE((choice_item->'validation'->>'max_selections')::INTEGER, 10),
          1
        )
        ON CONFLICT (product_id, choice_group) DO NOTHING
        RETURNING id INTO new_choice_id;
        
        -- choice_id가 없으면 기존 것 찾기
        IF new_choice_id IS NULL THEN
          SELECT id INTO new_choice_id
          FROM product_choices
          WHERE product_choices.product_id = current_product_id 
          AND choice_group = COALESCE(choice_item->>'id', 'optional_choice');
        END IF;
        
        choices_count := choices_count + 1;
        
        -- options 처리
        IF choice_item ? 'options' AND jsonb_typeof(choice_item->'options') = 'array' THEN
          FOR choice_option IN SELECT * FROM jsonb_array_elements(choice_item->'options')
          LOOP
            INSERT INTO choice_options (
              choice_id,
              option_key,
              option_name,
              option_name_ko,
              adult_price,
              child_price,
              infant_price,
              capacity,
              is_default,
              is_active,
              sort_order
            ) VALUES (
              new_choice_id,
              COALESCE(choice_option->>'id', 'default_option'),
              COALESCE(choice_option->>'name', '기본 옵션'),
              COALESCE(choice_option->>'name_ko', choice_option->>'name', '기본 옵션'),
              COALESCE((choice_option->>'adult_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'child_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'infant_price')::DECIMAL(10,2), 0),
              COALESCE((choice_option->>'capacity_per_room')::INTEGER, 1),
              COALESCE((choice_option->>'is_default')::BOOLEAN, false),
              true,
              0
            )
            ON CONFLICT (choice_id, option_key) DO NOTHING;
            
            options_count := options_count + 1;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 3. 기존 예약 choices를 새로운 구조로 변환하는 함수
CREATE OR REPLACE FUNCTION migrate_existing_reservation_choices_to_simple()
RETURNS TABLE(
  reservation_id TEXT,
  migrated_choices INTEGER
) AS $$
DECLARE
  reservation_record RECORD;
  choice_item JSONB;
  choice_selection JSONB;
  new_choice_id UUID;
  new_option_id UUID;
  choices_count INTEGER := 0;
BEGIN
  -- 모든 예약의 choices 데이터 처리
  FOR reservation_record IN
    SELECT id, choices
    FROM reservations
    WHERE choices IS NOT NULL
  LOOP
    -- required choices 처리
    IF reservation_record.choices ? 'required' AND jsonb_typeof(reservation_record.choices->'required') = 'array' THEN
      FOR choice_item IN SELECT * FROM jsonb_array_elements(reservation_record.choices->'required')
      LOOP
        -- 해당 choice의 ID 찾기
        SELECT pc.id INTO new_choice_id
        FROM product_choices pc
        JOIN reservations r ON pc.product_id = r.product_id
        WHERE r.id = reservation_record.id
        AND pc.choice_group = choice_item->>'id';
        
        IF new_choice_id IS NOT NULL THEN
          -- 단일 선택인 경우
          IF choice_item ? 'selected' THEN
            SELECT co.id INTO new_option_id
            FROM choice_options co
            WHERE co.choice_id = new_choice_id
            AND co.option_key = choice_item->>'selected';
            
            IF new_option_id IS NOT NULL THEN
              INSERT INTO reservation_choices (
                reservation_id,
                choice_id,
                option_id,
                quantity,
                total_price
              ) VALUES (
                reservation_record.id,
                new_choice_id,
                new_option_id,
                1,
                0 -- 가격은 나중에 계산
              )
              ON CONFLICT (reservation_id, choice_id, option_id) DO NOTHING;
              
              choices_count := choices_count + 1;
            END IF;
          END IF;
          
          -- 수량 기반 다중 선택인 경우
          IF choice_item ? 'selections' AND jsonb_typeof(choice_item->'selections') = 'array' THEN
            FOR choice_selection IN SELECT * FROM jsonb_array_elements(choice_item->'selections')
            LOOP
              SELECT co.id INTO new_option_id
              FROM choice_options co
              WHERE co.choice_id = new_choice_id
              AND co.option_key = choice_selection->'option'->>'id';
              
              IF new_option_id IS NOT NULL THEN
                INSERT INTO reservation_choices (
                  reservation_id,
                  choice_id,
                  option_id,
                  quantity,
                  total_price
                ) VALUES (
                  reservation_record.id,
                  new_choice_id,
                  new_option_id,
                  COALESCE((choice_selection->>'quantity')::INTEGER, 1),
                  COALESCE((choice_selection->>'total_price')::DECIMAL(10,2), 0)
                )
                ON CONFLICT (reservation_id, choice_id, option_id) DO NOTHING;
                
                choices_count := choices_count + 1;
              END IF;
            END LOOP;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 4. 마이그레이션 실행
DO $$
DECLARE
  result RECORD;
  total_choices INTEGER := 0;
  total_options INTEGER := 0;
  total_reservation_choices INTEGER := 0;
BEGIN
  RAISE NOTICE '기존 choices 데이터 마이그레이션 시작...';
  
  -- 상품 choices 마이그레이션
  FOR result IN SELECT * FROM migrate_existing_choices_to_simple() LOOP
    total_choices := total_choices + result.migrated_choices;
    total_options := total_options + result.migrated_options;
  END LOOP;
  
  RAISE NOTICE '상품 choices 마이그레이션 완료: % choices, % options', total_choices, total_options;
  
  -- 예약 choices 마이그레이션
  FOR result IN SELECT * FROM migrate_existing_reservation_choices_to_simple() LOOP
    total_reservation_choices := total_reservation_choices + result.migrated_choices;
  END LOOP;
  
  RAISE NOTICE '예약 choices 마이그레이션 완료: % choices', total_reservation_choices;
  
  RAISE NOTICE '전체 마이그레이션 완료!';
END;
$$;

-- 5. 마이그레이션 결과 확인
SELECT 
  'Products with choices' as table_name,
  COUNT(*) as count
FROM products
WHERE choices IS NOT NULL

UNION ALL

SELECT 
  'Migrated product choices' as table_name,
  COUNT(*) as count
FROM product_choices

UNION ALL

SELECT 
  'Migrated choice options' as table_name,
  COUNT(*) as count
FROM choice_options

UNION ALL

SELECT 
  'Reservations with choices' as table_name,
  COUNT(*) as count
FROM reservations
WHERE choices IS NOT NULL

UNION ALL

SELECT 
  'Migrated reservation choices' as table_name,
  COUNT(*) as count
FROM reservation_choices;

-- 6. 데이터 검증
-- 상품별 마이그레이션된 choices 확인
SELECT 
  p.id as product_id,
  p.name_ko as product_name,
  COUNT(pc.id) as choices_count,
  COUNT(co.id) as options_count
FROM products p
LEFT JOIN product_choices pc ON p.id = pc.product_id
LEFT JOIN choice_options co ON pc.id = co.choice_id
WHERE p.choices IS NOT NULL
GROUP BY p.id, p.name_ko
ORDER BY p.name_ko;

-- 예약별 마이그레이션된 choices 확인
SELECT 
  r.id as reservation_id,
  r.customer_name,
  COUNT(rc.id) as choices_count
FROM reservations r
LEFT JOIN reservation_choices rc ON r.id = rc.reservation_id
WHERE r.choices IS NOT NULL
GROUP BY r.id, r.customer_name
ORDER BY r.customer_name;

-- 7. 샘플 데이터 확인
-- 마이그레이션된 choices 데이터 샘플
SELECT 
  pc.choice_group,
  pc.choice_group_ko,
  pc.choice_type,
  pc.is_required,
  co.option_key,
  co.option_name_ko,
  co.adult_price,
  co.capacity
FROM product_choices pc
JOIN choice_options co ON pc.id = co.choice_id
ORDER BY pc.product_id, pc.sort_order, co.sort_order
LIMIT 10;

-- 8. 마이그레이션 완료 후 기존 컬럼 제거 (선택사항)
-- 주의: 이 부분은 마이그레이션이 완전히 성공했을 때만 실행하세요!
-- ALTER TABLE products DROP COLUMN IF EXISTS choices;
-- ALTER TABLE reservations DROP COLUMN IF EXISTS choices;

-- 9. 정리 함수들 (마이그레이션 완료 후 실행 가능)
-- DROP FUNCTION IF EXISTS migrate_existing_choices_to_simple();
-- DROP FUNCTION IF EXISTS migrate_existing_reservation_choices_to_simple();
