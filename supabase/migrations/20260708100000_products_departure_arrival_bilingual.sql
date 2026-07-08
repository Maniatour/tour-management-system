-- 출발/도착 정보 한·영 분리 (기존 값은 한국어 컬럼으로 이전)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS departure_city_ko VARCHAR(100),
  ADD COLUMN IF NOT EXISTS departure_city_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS arrival_city_ko VARCHAR(100),
  ADD COLUMN IF NOT EXISTS arrival_city_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS departure_country_ko VARCHAR(100),
  ADD COLUMN IF NOT EXISTS departure_country_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS arrival_country_ko VARCHAR(100),
  ADD COLUMN IF NOT EXISTS arrival_country_en VARCHAR(100);

UPDATE products
SET
  departure_city_ko = COALESCE(NULLIF(TRIM(departure_city_ko), ''), NULLIF(TRIM(departure_city), '')),
  departure_city_en = COALESCE(NULLIF(TRIM(departure_city_en), ''), NULLIF(TRIM(departure_city), '')),
  arrival_city_ko = COALESCE(NULLIF(TRIM(arrival_city_ko), ''), NULLIF(TRIM(arrival_city), '')),
  arrival_city_en = COALESCE(NULLIF(TRIM(arrival_city_en), ''), NULLIF(TRIM(arrival_city), '')),
  departure_country_ko = COALESCE(NULLIF(TRIM(departure_country_ko), ''), NULLIF(TRIM(departure_country), '')),
  departure_country_en = COALESCE(NULLIF(TRIM(departure_country_en), ''), NULLIF(TRIM(departure_country), '')),
  arrival_country_ko = COALESCE(NULLIF(TRIM(arrival_country_ko), ''), NULLIF(TRIM(arrival_country), '')),
  arrival_country_en = COALESCE(NULLIF(TRIM(arrival_country_en), ''), NULLIF(TRIM(arrival_country), ''))
WHERE departure_city IS NOT NULL
   OR arrival_city IS NOT NULL
   OR departure_country IS NOT NULL
   OR arrival_country IS NOT NULL;

-- 레거시 컬럼은 한국어 우선으로 동기화 (기존 코드 호환)
UPDATE products
SET
  departure_city = COALESCE(NULLIF(TRIM(departure_city_ko), ''), departure_city),
  arrival_city = COALESCE(NULLIF(TRIM(arrival_city_ko), ''), arrival_city),
  departure_country = COALESCE(NULLIF(TRIM(departure_country_ko), ''), departure_country),
  arrival_country = COALESCE(NULLIF(TRIM(arrival_country_ko), ''), arrival_country);
