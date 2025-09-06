-- 임시로 vehicle_number unique constraint 비활성화
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_number_key;

-- 중복된 vehicle_number에 접미사 추가
WITH duplicates AS (
  SELECT id, vehicle_number, 
         ROW_NUMBER() OVER (PARTITION BY vehicle_number ORDER BY created_at) as rn
  FROM vehicles
  WHERE vehicle_number IN (
    SELECT vehicle_number 
    FROM vehicles 
    GROUP BY vehicle_number 
    HAVING COUNT(*) > 1
  )
)
UPDATE vehicles 
SET vehicle_number = vehicles.vehicle_number || '_' || duplicates.rn
FROM duplicates 
WHERE vehicles.id = duplicates.id 
AND duplicates.rn > 1;

-- unique constraint 다시 활성화
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_number_key UNIQUE (vehicle_number);
