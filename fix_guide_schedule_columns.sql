-- 가이드 역할 선택 컬럼 추가 및 수정
-- 투어 스케줄에서 가이드 역할 선택이 저장되지 않는 문제 해결

-- 1. 필요한 컬럼들이 존재하는지 확인하고 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS two_guide_schedule VARCHAR(20) CHECK (two_guide_schedule IN ('guide', 'assistant')),
ADD COLUMN IF NOT EXISTS guide_driver_schedule VARCHAR(20) CHECK (guide_driver_schedule IN ('guide', 'assistant'));

-- 2. 기존 데이터 마이그레이션 (필요한 경우)
-- 기존 assigned_guide_1, assigned_guide_2 컬럼이 있다면 마이그레이션
DO $$
BEGIN
    -- two_guide_schedule 컬럼이 비어있고 assigned_guide_1이 있는 경우
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_schedules' AND column_name = 'assigned_guide_1') THEN
        UPDATE product_schedules 
        SET two_guide_schedule = CASE 
            WHEN assigned_guide_1 = 'guide' THEN 'guide'
            WHEN assigned_guide_2 = 'assistant' THEN 'assistant'
            ELSE NULL
        END
        WHERE two_guide_schedule IS NULL AND (assigned_guide_1 IS NOT NULL OR assigned_guide_2 IS NOT NULL);
    END IF;
    
    -- guide_driver_schedule 컬럼이 비어있고 assigned_driver가 있는 경우
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_schedules' AND column_name = 'assigned_driver') THEN
        UPDATE product_schedules 
        SET guide_driver_schedule = CASE 
            WHEN assigned_guide_1 = 'guide' THEN 'guide'
            WHEN assigned_driver = 'driver' THEN 'assistant'
            ELSE NULL
        END
        WHERE guide_driver_schedule IS NULL AND (assigned_guide_1 IS NOT NULL OR assigned_driver IS NOT NULL);
    END IF;
END $$;

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_two_guide_schedule ON product_schedules(two_guide_schedule);
CREATE INDEX IF NOT EXISTS idx_product_schedules_guide_driver_schedule ON product_schedules(guide_driver_schedule);

-- 4. 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND (column_name LIKE '%guide%' OR column_name LIKE '%driver%' OR column_name LIKE '%schedule%')
ORDER BY ordinal_position;

-- 5. 샘플 데이터 확인
SELECT 
    id,
    product_id,
    title_ko,
    two_guide_schedule,
    guide_driver_schedule,
    created_at
FROM product_schedules 
WHERE two_guide_schedule IS NOT NULL OR guide_driver_schedule IS NOT NULL
LIMIT 5;
