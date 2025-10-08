-- 차량 사진 테이블 생성 (여러 장 지원)
CREATE TABLE IF NOT EXISTS vehicle_photos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vehicle_id TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    photo_name TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    CONSTRAINT fk_vehicle_photos_vehicle_id 
        FOREIGN KEY (vehicle_id) 
        REFERENCES vehicles(id) 
        ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_display_order ON vehicle_photos(vehicle_id, display_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_is_primary ON vehicle_photos(vehicle_id, is_primary);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_vehicle_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_photos_updated_at
    BEFORE UPDATE ON vehicle_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_photos_updated_at();

-- RLS 정책 설정
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Allow read access to vehicle photos" ON vehicle_photos
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "Allow insert access to vehicle photos" ON vehicle_photos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "Allow update access to vehicle photos" ON vehicle_photos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "Allow delete access to vehicle photos" ON vehicle_photos
    FOR DELETE USING (auth.role() = 'authenticated');

-- 기본 사진이 하나만 있도록 하는 제약조건
CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
    -- 새로 추가되는 사진이 기본 사진으로 설정되는 경우
    IF NEW.is_primary = true THEN
        -- 같은 차량의 다른 사진들을 기본 사진에서 해제
        UPDATE vehicle_photos 
        SET is_primary = false 
        WHERE vehicle_id = NEW.vehicle_id 
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_photo
    BEFORE INSERT OR UPDATE ON vehicle_photos
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_photo();
