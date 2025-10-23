-- Create vehicle maintenance table for vehicle maintenance tracking
-- Migration: 202501200003_create_vehicle_maintenance_table.sql

begin;

-- 차량 정비 테이블 (차량별 정비 기록 관리)
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    id TEXT PRIMARY KEY, -- 고유 식별자
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE, -- 차량 ID
    maintenance_date DATE NOT NULL, -- 정비 날짜
    mileage INTEGER, -- 정비 시 마일리지
    
    -- 정비 정보
    maintenance_type VARCHAR(100) NOT NULL, -- 정비 유형 (maintenance, repair, service, inspection)
    category VARCHAR(100) NOT NULL, -- 카테고리 (engine, transmission, brakes, tires, etc.)
    subcategory VARCHAR(100), -- 하위 카테고리 (oil_change, tire_rotation, brake_pad, etc.)
    description TEXT NOT NULL, -- 정비 내용 설명
    
    -- 비용 정보
    total_cost DECIMAL(10,2) NOT NULL, -- 총 비용
    labor_cost DECIMAL(10,2), -- 인건비
    parts_cost DECIMAL(10,2), -- 부품비
    other_cost DECIMAL(10,2), -- 기타 비용
    
    -- 정비소 정보
    service_provider VARCHAR(255), -- 정비소명
    service_provider_contact VARCHAR(255), -- 정비소 연락처
    service_provider_address TEXT, -- 정비소 주소
    
    -- 워런티 및 보증
    warranty_period INTEGER, -- 워런티 기간 (일)
    warranty_expires DATE, -- 워런티 만료일
    warranty_notes TEXT, -- 워런티 관련 메모
    
    -- 정기 정비 정보
    is_scheduled_maintenance BOOLEAN DEFAULT false, -- 정기 정비 여부
    next_maintenance_date DATE, -- 다음 정비 예정일
    next_maintenance_mileage INTEGER, -- 다음 정비 예정 마일리지
    maintenance_interval INTEGER, -- 정비 주기 (일)
    mileage_interval INTEGER, -- 마일리지 주기
    
    -- 부품 정보
    parts_replaced TEXT[], -- 교체된 부품 목록
    parts_cost_breakdown JSONB, -- 부품별 비용 상세
    
    -- 상태 및 품질
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5), -- 품질 평가 (1-5)
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5), -- 만족도 평가 (1-5)
    issues_found TEXT[], -- 발견된 문제점
    recommendations TEXT[], -- 권장사항
    
    -- 첨부파일
    photos TEXT[], -- 정비 사진 URLs
    receipts TEXT[], -- 영수증 URLs
    documents TEXT[], -- 관련 문서 URLs
    
    -- 메모
    notes TEXT, -- 메모
    technician_notes TEXT, -- 정비사 메모
    
    -- 승인 및 상태
    status VARCHAR(50) DEFAULT 'completed', -- 상태 (scheduled, in_progress, completed, cancelled)
    approved_by VARCHAR(255), -- 승인자
    approved_on TIMESTAMP WITH TIME ZONE, -- 승인일시
    
    -- 연동 정보
    company_expense_id TEXT REFERENCES company_expenses(id) ON DELETE SET NULL, -- 연동된 회사 지출 ID
    
    -- 감사 정보
    created_by VARCHAR(255), -- 생성자
    updated_by VARCHAR(255), -- 수정자
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_vehicle_maintenance_vehicle_id ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicle_maintenance_date ON vehicle_maintenance(maintenance_date);
CREATE INDEX idx_vehicle_maintenance_type ON vehicle_maintenance(maintenance_type);
CREATE INDEX idx_vehicle_maintenance_category ON vehicle_maintenance(category);
CREATE INDEX idx_vehicle_maintenance_status ON vehicle_maintenance(status);
CREATE INDEX idx_vehicle_maintenance_next_date ON vehicle_maintenance(next_maintenance_date);
CREATE INDEX idx_vehicle_maintenance_company_expense_id ON vehicle_maintenance(company_expense_id);

-- RLS 정책 설정
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "vehicle_maintenance_select_all" ON vehicle_maintenance
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "vehicle_maintenance_insert_staff" ON vehicle_maintenance
    FOR INSERT
    WITH CHECK (true);

-- 스태프만 수정 가능
CREATE POLICY "vehicle_maintenance_update_staff" ON vehicle_maintenance
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 스태프만 삭제 가능
CREATE POLICY "vehicle_maintenance_delete_staff" ON vehicle_maintenance
    FOR DELETE
    USING (true);

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_vehicle_maintenance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_maintenance_updated_at
    BEFORE UPDATE ON vehicle_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_maintenance_updated_at();

-- 워런티 만료일 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_warranty_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warranty_period IS NOT NULL AND NEW.maintenance_date IS NOT NULL THEN
        NEW.warranty_expires = NEW.maintenance_date + INTERVAL '1 day' * NEW.warranty_period;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_warranty_expiry
    BEFORE INSERT OR UPDATE ON vehicle_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_warranty_expiry();

-- 다음 정비일 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_next_maintenance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_scheduled_maintenance = true THEN
        IF NEW.maintenance_interval IS NOT NULL AND NEW.maintenance_date IS NOT NULL THEN
            NEW.next_maintenance_date = NEW.maintenance_date + INTERVAL '1 day' * NEW.maintenance_interval;
        END IF;
        IF NEW.mileage_interval IS NOT NULL AND NEW.mileage IS NOT NULL THEN
            NEW.next_maintenance_mileage = NEW.mileage + NEW.mileage_interval;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_next_maintenance
    BEFORE INSERT OR UPDATE ON vehicle_maintenance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_next_maintenance();

commit;
