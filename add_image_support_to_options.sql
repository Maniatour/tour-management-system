-- 옵션과 초이스에 이미지 기능 추가
-- 고객 페이지에서 시각적으로 표시할 수 있도록 이미지 필드 추가

-- 1. options 테이블에 이미지 관련 컬럼 추가
ALTER TABLE options ADD COLUMN IF NOT EXISTS image_url TEXT; -- 이미지 URL
ALTER TABLE options ADD COLUMN IF NOT EXISTS image_alt TEXT; -- 이미지 대체 텍스트
ALTER TABLE options ADD COLUMN IF NOT EXISTS thumbnail_url TEXT; -- 썸네일 URL
ALTER TABLE options ADD COLUMN IF NOT EXISTS image_order INTEGER DEFAULT 0; -- 이미지 순서 (여러 이미지 지원)

-- 2. 이미지 관련 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_options_image_url ON options(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_options_thumbnail_url ON options(thumbnail_url) WHERE thumbnail_url IS NOT NULL;

-- 3. 기존 데이터에 대한 샘플 이미지 URL 업데이트 (선택사항)
-- 실제 이미지가 있을 때만 업데이트
UPDATE options 
SET 
  image_url = CASE 
    WHEN category = 'accommodation' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop'
    WHEN category = 'transportation' THEN 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop'
    WHEN category = 'meal' THEN 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
    WHEN category = 'activity' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop'
    WHEN category = 'insurance' THEN 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop'
    WHEN category = 'equipment' THEN 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop'
    ELSE NULL
  END,
  image_alt = CASE 
    WHEN category = 'accommodation' THEN '숙박 시설 이미지'
    WHEN category = 'transportation' THEN '교통 수단 이미지'
    WHEN category = 'meal' THEN '식사 이미지'
    WHEN category = 'activity' THEN '액티비티 이미지'
    WHEN category = 'insurance' THEN '보험 이미지'
    WHEN category = 'equipment' THEN '장비 이미지'
    ELSE NULL
  END,
  thumbnail_url = CASE 
    WHEN category = 'accommodation' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=150&fit=crop'
    WHEN category = 'transportation' THEN 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200&h=150&fit=crop'
    WHEN category = 'meal' THEN 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop'
    WHEN category = 'activity' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&h=150&fit=crop'
    WHEN category = 'insurance' THEN 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=200&h=150&fit=crop'
    WHEN category = 'equipment' THEN 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=200&h=150&fit=crop'
    ELSE NULL
  END
WHERE image_url IS NULL AND category IN ('accommodation', 'transportation', 'meal', 'activity', 'insurance', 'equipment');

-- 4. 이미지 관련 제약 조건 추가
ALTER TABLE options ADD CONSTRAINT check_image_url_format 
  CHECK (image_url IS NULL OR image_url ~ '^https?://.*\.(jpg|jpeg|png|gif|webp)$');

ALTER TABLE options ADD CONSTRAINT check_thumbnail_url_format 
  CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https?://.*\.(jpg|jpeg|png|gif|webp)$');

-- 5. 이미지 관련 함수 생성 (이미지 URL 검증)
CREATE OR REPLACE FUNCTION validate_image_url(url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF url IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- URL 형식 검증
  IF url !~ '^https?://.*\.(jpg|jpeg|png|gif|webp)$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. 이미지 관련 뷰 생성 (이미지가 있는 옵션만)
CREATE OR REPLACE VIEW options_with_images AS
SELECT 
  id,
  name,
  name_ko,
  description,
  category,
  adult_price,
  child_price,
  infant_price,
  price_type,
  status,
  tags,
  is_choice_template,
  choice_type,
  min_selections,
  max_selections,
  template_group,
  template_group_ko,
  is_required,
  sort_order,
  image_url,
  image_alt,
  thumbnail_url,
  image_order,
  created_at
FROM options
WHERE image_url IS NOT NULL
ORDER BY category, sort_order, name;

-- 7. 이미지 통계 함수
CREATE OR REPLACE FUNCTION get_image_stats()
RETURNS TABLE(
  total_options INTEGER,
  options_with_images INTEGER,
  options_without_images INTEGER,
  category_stats JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_options,
    COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END)::INTEGER as options_with_images,
    COUNT(CASE WHEN image_url IS NULL THEN 1 END)::INTEGER as options_without_images,
    jsonb_object_agg(
      category, 
      jsonb_build_object(
        'total', COUNT(*),
        'with_images', COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END),
        'without_images', COUNT(CASE WHEN image_url IS NULL THEN 1 END)
      )
    ) as category_stats
  FROM options;
END;
$$ LANGUAGE plpgsql;

-- 8. 샘플 데이터에 이미지 추가 (초이스 템플릿용)
UPDATE options 
SET 
  image_url = CASE 
    WHEN id = 'choice-accommodation-single' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop'
    WHEN id = 'choice-accommodation-double' THEN 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=300&fit=crop'
    WHEN id = 'choice-accommodation-triple' THEN 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop'
    WHEN id = 'choice-transportation-bus' THEN 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop'
    WHEN id = 'choice-transportation-van' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop'
    WHEN id = 'choice-meal-breakfast' THEN 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
    WHEN id = 'choice-meal-lunch' THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
    WHEN id = 'choice-meal-dinner' THEN 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop'
    WHEN id = 'choice-activity-hiking' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop'
    WHEN id = 'choice-activity-swimming' THEN 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop'
    ELSE image_url
  END,
  image_alt = CASE 
    WHEN id = 'choice-accommodation-single' THEN '1인 1실 객실'
    WHEN id = 'choice-accommodation-double' THEN '2인 1실 객실'
    WHEN id = 'choice-accommodation-triple' THEN '3인 1실 객실'
    WHEN id = 'choice-transportation-bus' THEN '대형 버스'
    WHEN id = 'choice-transportation-van' THEN '소형 밴'
    WHEN id = 'choice-meal-breakfast' THEN '아침식사'
    WHEN id = 'choice-meal-lunch' THEN '점심식사'
    WHEN id = 'choice-meal-dinner' THEN '저녁식사'
    WHEN id = 'choice-activity-hiking' THEN '하이킹 활동'
    WHEN id = 'choice-activity-swimming' THEN '수영 활동'
    ELSE image_alt
  END,
  thumbnail_url = CASE 
    WHEN id = 'choice-accommodation-single' THEN 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=150&fit=crop'
    WHEN id = 'choice-accommodation-double' THEN 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200&h=150&fit=crop'
    WHEN id = 'choice-accommodation-triple' THEN 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200&h=150&fit=crop'
    WHEN id = 'choice-transportation-bus' THEN 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200&h=150&fit=crop'
    WHEN id = 'choice-transportation-van' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=150&fit=crop'
    WHEN id = 'choice-meal-breakfast' THEN 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop'
    WHEN id = 'choice-meal-lunch' THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop'
    WHEN id = 'choice-meal-dinner' THEN 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=150&fit=crop'
    WHEN id = 'choice-activity-hiking' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&h=150&fit=crop'
    WHEN id = 'choice-activity-swimming' THEN 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=200&h=150&fit=crop'
    ELSE thumbnail_url
  END
WHERE is_choice_template = true;

-- 9. 이미지 관련 트리거 생성 (이미지 URL 자동 검증)
CREATE OR REPLACE FUNCTION validate_option_images()
RETURNS TRIGGER AS $$
BEGIN
  -- 이미지 URL 형식 검증
  IF NOT validate_image_url(NEW.image_url) THEN
    RAISE EXCEPTION 'Invalid image URL format: %', NEW.image_url;
  END IF;
  
  IF NOT validate_image_url(NEW.thumbnail_url) THEN
    RAISE EXCEPTION 'Invalid thumbnail URL format: %', NEW.thumbnail_url;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_option_images_trigger
  BEFORE INSERT OR UPDATE ON options
  FOR EACH ROW
  EXECUTE FUNCTION validate_option_images();

-- 10. 완료 메시지
SELECT '이미지 기능이 성공적으로 추가되었습니다!' as message;
