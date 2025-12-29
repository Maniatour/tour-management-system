-- 초이스 시스템 대대적 개선
-- 문제: products의 초이스를 수정하면 ID가 변경되어 예전 예약과 매칭 실패
-- 해결: 안정적인 식별자(option_key, choice_group)를 reservation_choices에 저장

-- 1. reservation_choices 테이블에 안정적인 식별자 컬럼 추가
ALTER TABLE reservation_choices 
ADD COLUMN IF NOT EXISTS choice_group TEXT,
ADD COLUMN IF NOT EXISTS option_key TEXT;

-- 2. 기존 reservation_choices 데이터에 choice_group과 option_key 채우기
UPDATE reservation_choices rc
SET 
  choice_group = pc.choice_group,
  option_key = co.option_key
FROM product_choices pc
JOIN choice_options co ON co.choice_id = pc.id
WHERE rc.choice_id = pc.id 
  AND rc.option_id = co.id
  AND (rc.choice_group IS NULL OR rc.option_key IS NULL);

-- 3. 인덱스 추가 (안정적인 식별자 기반 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_reservation_choices_choice_group 
ON reservation_choices(choice_group) 
WHERE choice_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_choices_option_key 
ON reservation_choices(option_key) 
WHERE option_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_choices_product_lookup 
ON reservation_choices(reservation_id, choice_group, option_key);

-- 4. product_choices에 choice_group_key 추가 (안정적인 그룹 식별자)
ALTER TABLE product_choices 
ADD COLUMN IF NOT EXISTS choice_group_key TEXT;

-- 5. 기존 choice_group을 choice_group_key로 복사 (없는 경우)
-- choice_group_ko에서 안정적인 키 생성 (예: "앤텔롭 캐년 선택" -> "antelope_canyon_choice")
UPDATE product_choices
SET choice_group_key = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(choice_group_ko, '[^가-힣a-zA-Z0-9]', '_', 'g'),
      '_+', '_', 'g'
    ),
    '^_|_$', '', 'g'
  )
)
WHERE choice_group_key IS NULL OR choice_group_key = '';

-- 6. choice_group_key에 UNIQUE 제약 추가 (product_id와 함께)
-- 기존 UNIQUE(product_id, choice_group) 제약이 있으므로 choice_group_key도 동일하게
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_choices_product_id_choice_group_key_key'
  ) THEN
    ALTER TABLE product_choices 
    ADD CONSTRAINT product_choices_product_id_choice_group_key_key 
    UNIQUE(product_id, choice_group_key);
  END IF;
END $$;

-- 7. choice_options에 option_key가 없는 경우 자동 생성
UPDATE choice_options co
SET option_key = LOWER(REPLACE(REPLACE(REPLACE(co.option_name_ko, ' ', '_'), '/', '_'), '(', ''))
WHERE option_key IS NULL OR option_key = '';

-- 8. 트리거 함수: reservation_choices에 데이터 삽입 시 자동으로 choice_group과 option_key 채우기
CREATE OR REPLACE FUNCTION auto_fill_choice_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  -- choice_id와 option_id가 있으면 choice_group과 option_key 자동 채우기
  IF NEW.choice_id IS NOT NULL AND NEW.option_id IS NOT NULL THEN
    SELECT 
      pc.choice_group_key,
      co.option_key
    INTO 
      NEW.choice_group,
      NEW.option_key
    FROM product_choices pc
    JOIN choice_options co ON co.choice_id = pc.id
    WHERE pc.id = NEW.choice_id 
      AND co.id = NEW.option_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 트리거 생성
DROP TRIGGER IF EXISTS trigger_auto_fill_choice_identifiers ON reservation_choices;
CREATE TRIGGER trigger_auto_fill_choice_identifiers
  BEFORE INSERT OR UPDATE ON reservation_choices
  FOR EACH ROW
  WHEN (NEW.choice_group IS NULL OR NEW.option_key IS NULL)
  EXECUTE FUNCTION auto_fill_choice_identifiers();

-- 10. 기존 예약 데이터 복구 함수 (ID가 변경되어 매칭 실패한 경우)
CREATE OR REPLACE FUNCTION repair_reservation_choices()
RETURNS TABLE(
  reservation_id TEXT,
  repaired_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  rec RECORD;
  repaired INTEGER := 0;
  errors INTEGER := 0;
  matched_choice_id UUID;
  matched_option_id UUID;
BEGIN
  -- choice_group과 option_key는 있지만 choice_id나 option_id가 매칭되지 않은 경우
  FOR rec IN 
    SELECT DISTINCT
      rc.reservation_id,
      rc.choice_group,
      rc.option_key,
      r.product_id
    FROM reservation_choices rc
    JOIN reservations r ON r.id = rc.reservation_id
    WHERE (rc.choice_id IS NULL OR rc.option_id IS NULL)
      AND rc.choice_group IS NOT NULL
      AND rc.option_key IS NOT NULL
      AND r.product_id IS NOT NULL
  LOOP
    BEGIN
      -- 현재 상품의 choice_group_key와 option_key로 매칭
      SELECT 
        pc.id,
        co.id
      INTO 
        matched_choice_id,
        matched_option_id
      FROM product_choices pc
      JOIN choice_options co ON co.choice_id = pc.id
      WHERE pc.product_id = rec.product_id
        AND pc.choice_group_key = rec.choice_group
        AND co.option_key = rec.option_key
      LIMIT 1;
      
      IF matched_choice_id IS NOT NULL AND matched_option_id IS NOT NULL THEN
        -- 매칭된 ID로 업데이트
        UPDATE reservation_choices
        SET 
          choice_id = matched_choice_id,
          option_id = matched_option_id
        WHERE reservation_id = rec.reservation_id
          AND choice_group = rec.choice_group
          AND option_key = rec.option_key
          AND (choice_id IS NULL OR option_id IS NULL);
        
        repaired := repaired + 1;
      ELSE
        errors := errors + 1;
        RAISE WARNING 'Cannot match choice for reservation %: product_id=%, choice_group=%, option_key=%', 
          rec.reservation_id, rec.product_id, rec.choice_group, rec.option_key;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
      RAISE WARNING 'Error repairing reservation %: %', rec.reservation_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    'TOTAL'::TEXT,
    repaired,
    errors;
END;
$$ LANGUAGE plpgsql;

-- 11. 조회 성능 향상을 위한 뷰 생성 (안정적인 식별자 기반)
CREATE OR REPLACE VIEW reservation_choices_with_names AS
SELECT 
  rc.reservation_id,
  rc.choice_id,
  rc.option_id,
  rc.choice_group,
  rc.option_key,
  rc.quantity,
  rc.total_price,
  pc.choice_group_ko,
  pc.choice_group_en,
  co.option_name,
  co.option_name_ko,
  co.adult_price,
  co.child_price,
  co.infant_price
FROM reservation_choices rc
LEFT JOIN product_choices pc ON (
  pc.id = rc.choice_id 
  OR (rc.choice_group IS NOT NULL AND pc.choice_group_key = rc.choice_group)
)
LEFT JOIN choice_options co ON (
  co.id = rc.option_id
  OR (co.choice_id = pc.id AND rc.option_key IS NOT NULL AND co.option_key = rc.option_key)
);

-- 12. 코멘트 추가
COMMENT ON COLUMN reservation_choices.choice_group IS '안정적인 초이스 그룹 식별자 (ID 변경과 무관)';
COMMENT ON COLUMN reservation_choices.option_key IS '안정적인 옵션 식별자 (ID 변경과 무관)';
COMMENT ON COLUMN product_choices.choice_group_key IS '안정적인 초이스 그룹 키 (product_id와 함께 UNIQUE)';

-- 13. 마이그레이션 실행 안내
-- 다음 명령어로 기존 데이터 복구 실행:
-- SELECT * FROM repair_reservation_choices();

