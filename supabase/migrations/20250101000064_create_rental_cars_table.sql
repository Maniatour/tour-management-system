-- 렌터카 관리 테이블 생성
CREATE TABLE IF NOT EXISTS rental_cars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rental_company TEXT NOT NULL, -- 렌터카 회사명 (예: Hertz, Enterprise, Budget)
    vehicle_type TEXT NOT NULL, -- 차량 타입
    vehicle_model TEXT NOT NULL, -- 차량 모델명
    license_plate TEXT NOT NULL, -- 번호판
    vin TEXT, -- VIN 번호
    capacity INTEGER NOT NULL, -- 탑승인원
    year INTEGER NOT NULL, -- 연식
    color TEXT, -- 색상
    fuel_type TEXT DEFAULT 'gasoline', -- 연료 타입 (gasoline, diesel, hybrid, electric)
    transmission TEXT DEFAULT 'automatic', -- 변속기 (automatic, manual)
    
    -- 렌터카 특화 정보
    rental_contract_number TEXT, -- 렌터카 계약 번호
    daily_rate DECIMAL(10,2) NOT NULL, -- 일일 렌탈료
    weekly_rate DECIMAL(10,2), -- 주간 렌탈료
    monthly_rate DECIMAL(10,2), -- 월간 렌탈료
    insurance_coverage TEXT, -- 보험 커버리지
    mileage_limit INTEGER, -- 주행거리 제한 (miles)
    excess_mileage_rate DECIMAL(10,2), -- 초과 주행거리 요금
    
    -- 렌터카 상태
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'returned')),
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 렌터카 예약 테이블 생성
CREATE TABLE IF NOT EXISTS rental_car_reservations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rental_car_id TEXT NOT NULL REFERENCES rental_cars(id) ON DELETE CASCADE,
    reservation_type TEXT NOT NULL CHECK (reservation_type IN ('single_tour', 'multi_tour', 'weekly', 'monthly')),
    
    -- 예약 기간
    pickup_date DATE NOT NULL,
    pickup_time TIME NOT NULL,
    pickup_location TEXT NOT NULL, -- 픽업 장소
    return_date DATE NOT NULL,
    return_time TIME NOT NULL,
    return_location TEXT NOT NULL, -- 반납 장소
    
    -- 예약 정보
    total_days INTEGER NOT NULL, -- 총 렌탈 일수
    daily_rate DECIMAL(10,2) NOT NULL, -- 적용된 일일 요금
    total_cost DECIMAL(10,2) NOT NULL, -- 총 비용
    deposit_amount DECIMAL(10,2) DEFAULT 0, -- 보증금
    insurance_cost DECIMAL(10,2) DEFAULT 0, -- 보험비
    
    -- 연락처 정보
    contact_person TEXT NOT NULL, -- 담당자
    contact_phone TEXT NOT NULL, -- 연락처
    contact_email TEXT, -- 이메일
    
    -- 상태 관리
    status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'picked_up', 'in_use', 'returned', 'cancelled')),
    actual_pickup_date DATE, -- 실제 픽업 날짜
    actual_pickup_time TIME, -- 실제 픽업 시간
    actual_return_date DATE, -- 실제 반납 날짜
    actual_return_time TIME, -- 실제 반납 시간
    actual_mileage_start INTEGER, -- 픽업시 주행거리
    actual_mileage_end INTEGER, -- 반납시 주행거리
    
    -- 메모 및 특이사항
    notes TEXT,
    damage_report TEXT, -- 손상 보고서
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 렌터카-투어 연결 테이블 (다대다 관계)
CREATE TABLE IF NOT EXISTS rental_car_tour_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rental_car_reservation_id TEXT NOT NULL REFERENCES rental_car_reservations(id) ON DELETE CASCADE,
    tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL, -- 투어 날짜
    driver_name TEXT, -- 운전자 이름
    start_time TIME, -- 투어 시작 시간
    end_time TIME, -- 투어 종료 시간
    notes TEXT, -- 특이사항
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rental_cars_company ON rental_cars(rental_company);
CREATE INDEX IF NOT EXISTS idx_rental_cars_status ON rental_cars(status);
CREATE INDEX IF NOT EXISTS idx_rental_car_reservations_dates ON rental_car_reservations(pickup_date, return_date);
CREATE INDEX IF NOT EXISTS idx_rental_car_reservations_status ON rental_car_reservations(status);
CREATE INDEX IF NOT EXISTS idx_rental_car_tour_assignments_tour ON rental_car_tour_assignments(tour_id);
CREATE INDEX IF NOT EXISTS idx_rental_car_tour_assignments_reservation ON rental_car_tour_assignments(rental_car_reservation_id);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_rental_cars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rental_cars_updated_at
    BEFORE UPDATE ON rental_cars
    FOR EACH ROW
    EXECUTE FUNCTION update_rental_cars_updated_at();

CREATE TRIGGER trigger_update_rental_car_reservations_updated_at
    BEFORE UPDATE ON rental_car_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_rental_cars_updated_at();

-- RLS 정책 설정
ALTER TABLE rental_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_car_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_car_tour_assignments ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 렌터카 정보를 읽을 수 있도록 설정
CREATE POLICY "Allow all users to read rental_cars" ON rental_cars
    FOR SELECT USING (true);

-- 모든 사용자가 렌터카를 수정할 수 있도록 설정
CREATE POLICY "Allow all users to modify rental_cars" ON rental_cars
    FOR ALL USING (true);

-- 모든 사용자가 렌터카 예약을 읽을 수 있도록 설정
CREATE POLICY "Allow all users to read rental_car_reservations" ON rental_car_reservations
    FOR SELECT USING (true);

-- 모든 사용자가 렌터카 예약을 수정할 수 있도록 설정
CREATE POLICY "Allow all users to modify rental_car_reservations" ON rental_car_reservations
    FOR ALL USING (true);

-- 모든 사용자가 렌터카-투어 배정을 읽을 수 있도록 설정
CREATE POLICY "Allow all users to read rental_car_tour_assignments" ON rental_car_tour_assignments
    FOR SELECT USING (true);

-- 모든 사용자가 렌터카-투어 배정을 수정할 수 있도록 설정
CREATE POLICY "Allow all users to modify rental_car_tour_assignments" ON rental_car_tour_assignments
    FOR ALL USING (true);
