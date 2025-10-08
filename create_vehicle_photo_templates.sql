-- 차량 타입별 사진 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS vehicle_photo_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vehicle_type TEXT NOT NULL,
    vehicle_model TEXT,
    photo_url TEXT NOT NULL,
    photo_name TEXT,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_photo_templates_vehicle_type ON vehicle_photo_templates(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_photo_templates_is_default ON vehicle_photo_templates(is_default);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_vehicle_photo_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_photo_templates_updated_at
    BEFORE UPDATE ON vehicle_photo_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_photo_templates_updated_at();

-- RLS 정책 설정
ALTER TABLE vehicle_photo_templates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Allow read access to vehicle photo templates" ON vehicle_photo_templates
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "Allow insert access to vehicle photo templates" ON vehicle_photo_templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "Allow update access to vehicle photo templates" ON vehicle_photo_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "Allow delete access to vehicle photo templates" ON vehicle_photo_templates
    FOR DELETE USING (auth.role() = 'authenticated');
