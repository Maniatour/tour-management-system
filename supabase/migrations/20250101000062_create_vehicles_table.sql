-- 차량 관리 테이블 생성
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vehicle_number TEXT NOT NULL UNIQUE,
    vin TEXT,
    vehicle_type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    year INTEGER NOT NULL,
    mileage_at_purchase INTEGER DEFAULT 0,
    purchase_amount DECIMAL(10,2) DEFAULT 0,
    purchase_date DATE,
    memo TEXT,
    
    -- 관리 정보
    engine_oil_change_cycle INTEGER DEFAULT 10000,
    current_mileage INTEGER DEFAULT 0,
    recent_engine_oil_change_mileage INTEGER DEFAULT 0,
    vehicle_status TEXT DEFAULT '운행 가능' CHECK (vehicle_status IN ('운행 가능', '수리 중', '대기 중', '폐차')),
    front_tire_size TEXT,
    rear_tire_size TEXT,
    windshield_wiper_size TEXT,
    headlight_model TEXT,
    headlight_model_name TEXT,
    
    -- 할부 정보
    is_installment BOOLEAN DEFAULT false,
    installment_amount DECIMAL(10,2) DEFAULT 0,
    interest_rate DECIMAL(5,2) DEFAULT 0,
    monthly_payment DECIMAL(10,2) DEFAULT 0,
    additional_payment DECIMAL(10,2) DEFAULT 0,
    payment_due_date DATE,
    installment_start_date DATE,
    installment_end_date DATE,
    
    -- 이미지
    vehicle_image_url TEXT,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_number ON vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(vehicle_status);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicles_updated_at();

-- RLS 정책 설정
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 차량 정보를 읽을 수 있도록 설정
CREATE POLICY "Allow all users to read vehicles" ON vehicles
    FOR SELECT USING (true);

-- 모든 사용자가 차량을 수정할 수 있도록 설정 (관리자 권한 확인은 애플리케이션 레벨에서)
CREATE POLICY "Allow all users to modify vehicles" ON vehicles
    FOR ALL USING (true);
