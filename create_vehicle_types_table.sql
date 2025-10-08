-- 차종 관리 테이블 생성
CREATE TABLE IF NOT EXISTS vehicle_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    passenger_capacity INTEGER NOT NULL,
    vehicle_category TEXT NOT NULL DEFAULT 'rental',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_types_brand ON vehicle_types(brand);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_category ON vehicle_types(vehicle_category);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_active ON vehicle_types(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_display_order ON vehicle_types(display_order);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_vehicle_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_types_updated_at
    BEFORE UPDATE ON vehicle_types
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_types_updated_at();

-- RLS 정책 설정
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Allow read access to vehicle types" ON vehicle_types
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "Allow insert access to vehicle types" ON vehicle_types
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "Allow update access to vehicle types" ON vehicle_types
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "Allow delete access to vehicle types" ON vehicle_types
    FOR DELETE USING (auth.role() = 'authenticated');

-- 기본 차종 데이터 삽입
INSERT INTO vehicle_types (name, brand, model, passenger_capacity, vehicle_category, description, display_order) VALUES
('Ford Transit 12 passenger', 'Ford', 'Transit', 12, 'rental', 'Ford Transit 12인승', 1),
('Ford Transit 15 passenger', 'Ford', 'Transit', 15, 'rental', 'Ford Transit 15인승', 2),
('Chevy Express 12 passenger', 'Chevrolet', 'Express', 12, 'rental', 'Chevrolet Express 12인승', 3),
('Chevy Express 15 passenger', 'Chevrolet', 'Express', 15, 'rental', 'Chevrolet Express 15인승', 4),
('Sprinter 12 passenger', 'Mercedes-Benz', 'Sprinter', 12, 'rental', 'Mercedes-Benz Sprinter 12인승', 5),
('Sprinter 15 passenger', 'Mercedes-Benz', 'Sprinter', 15, 'rental', 'Mercedes-Benz Sprinter 15인승', 6),
('Chrysler Pacifica 7 passenger', 'Chrysler', 'Pacifica', 7, 'rental', 'Chrysler Pacifica 7인승', 7),
('Chrysler Pacifica 8 passenger', 'Chrysler', 'Pacifica', 8, 'rental', 'Chrysler Pacifica 8인승', 8),
('Toyota Sienna 7 passenger', 'Toyota', 'Sienna', 7, 'rental', 'Toyota Sienna 7인승', 9),
('Toyota Sienna 8 passenger', 'Toyota', 'Sienna', 8, 'rental', 'Toyota Sienna 8인승', 10)
ON CONFLICT (name) DO NOTHING;
