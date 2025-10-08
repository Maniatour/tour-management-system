-- 차종에 사진 필드 추가
ALTER TABLE vehicle_types 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_name TEXT;

-- 차종 사진을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_types_photo_url ON vehicle_types(photo_url);

-- 기존 차종들에 기본 사진 URL 추가 (예시)
UPDATE vehicle_types 
SET photo_url = 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=' || REPLACE(name, ' ', '+')
WHERE photo_url IS NULL;
