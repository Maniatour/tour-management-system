-- 기존 photo_url, photo_name 컬럼 제거
ALTER TABLE vehicle_types 
DROP COLUMN IF EXISTS photo_url,
DROP COLUMN IF EXISTS photo_name;

-- 차종 사진을 위한 별도 테이블 생성
CREATE TABLE IF NOT EXISTS vehicle_type_photos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vehicle_type_id TEXT NOT NULL REFERENCES vehicle_types(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_name TEXT,
    description TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_vehicle_type_id ON vehicle_type_photos(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_is_primary ON vehicle_type_photos(is_primary);
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_display_order ON vehicle_type_photos(display_order);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_vehicle_type_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_type_photos_updated_at
    BEFORE UPDATE ON vehicle_type_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_type_photos_updated_at();

-- RLS 정책 설정
ALTER TABLE vehicle_type_photos ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Allow read access to vehicle_type_photos" ON vehicle_type_photos
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "Allow insert access to vehicle_type_photos" ON vehicle_type_photos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "Allow update access to vehicle_type_photos" ON vehicle_type_photos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "Allow delete access to vehicle_type_photos" ON vehicle_type_photos
    FOR DELETE USING (auth.role() = 'authenticated');

-- 기본 사진이 하나만 있도록 제약조건 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_type_photos_unique_primary 
ON vehicle_type_photos(vehicle_type_id) 
WHERE is_primary = true;
