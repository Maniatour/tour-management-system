-- 기존 entry_time 컬럼을 entry_times로 변경하고 season_dates 구조 업데이트
ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS entry_times JSONB;

-- 기존 데이터 마이그레이션 (entry_time이 있는 경우 entry_times 배열로 변환)
UPDATE supplier_products 
SET entry_times = CASE 
  WHEN entry_time IS NOT NULL THEN jsonb_build_array(entry_time::text)
  ELSE NULL 
END
WHERE entry_times IS NULL;

-- 기존 entry_time 컬럼 제거
ALTER TABLE supplier_products DROP COLUMN IF EXISTS entry_time;

-- season_dates 구조를 배열로 변경 (기존 단일 객체를 배열로 변환)
UPDATE supplier_products 
SET season_dates = CASE 
  WHEN season_dates IS NOT NULL AND jsonb_typeof(season_dates) = 'object' THEN jsonb_build_array(season_dates)
  ELSE season_dates 
END
WHERE season_dates IS NOT NULL;
