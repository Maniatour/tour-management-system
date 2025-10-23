-- Create company expenses table for general company expense tracking
-- Migration: 202501200002_create_company_expenses_table.sql

begin;

-- 회사 지출 테이블 (일반적인 회사 지출 관리)
CREATE TABLE IF NOT EXISTS company_expenses (
    id TEXT PRIMARY KEY, -- 구글 시트 ID (텍스트 타입)
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 제출일시
    paid_to VARCHAR(255) NOT NULL, -- 결제처 (어디에)
    paid_for TEXT NOT NULL, -- 결제내용 (무엇을)
    description TEXT, -- 상세 설명
    amount DECIMAL(10,2) NOT NULL, -- 금액
    payment_method VARCHAR(100), -- 결제 방법
    submit_by VARCHAR(255) NOT NULL, -- 제출자 (user email)
    photo_url TEXT, -- 사진 URL
    
    -- 카테고리 분류
    category VARCHAR(100), -- 카테고리 (office, marketing, utilities, etc.)
    subcategory VARCHAR(100), -- 하위 카테고리
    
    -- 승인 및 정산 관련
    status VARCHAR(50) DEFAULT 'pending', -- 상태 (pending, approved, rejected, paid)
    approved_by VARCHAR(255), -- 승인자
    approved_on TIMESTAMP WITH TIME ZONE, -- 승인일시
    paid_by VARCHAR(255), -- 지급자
    paid_on TIMESTAMP WITH TIME ZONE, -- 지급일시
    
    -- 회계 관련
    accounting_period VARCHAR(20), -- 회계 기간 (YYYY-MM)
    expense_type VARCHAR(50), -- 지출 유형 (operating, capital, etc.)
    tax_deductible BOOLEAN DEFAULT true, -- 세금 공제 가능 여부
    
    -- 차량 관련 (차량 정비인 경우)
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL, -- 차량 ID
    maintenance_type VARCHAR(100), -- 정비 유형 (maintenance, repair, service)
    
    -- 메모 및 첨부파일
    notes TEXT, -- 메모
    attachments TEXT[], -- 첨부파일 URLs
    
    -- 감사 정보
    created_by VARCHAR(255), -- 생성자
    updated_by VARCHAR(255), -- 수정자
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_company_expenses_submit_by ON company_expenses(submit_by);
CREATE INDEX idx_company_expenses_status ON company_expenses(status);
CREATE INDEX idx_company_expenses_category ON company_expenses(category);
CREATE INDEX idx_company_expenses_accounting_period ON company_expenses(accounting_period);
CREATE INDEX idx_company_expenses_vehicle_id ON company_expenses(vehicle_id);
CREATE INDEX idx_company_expenses_created_at ON company_expenses(created_at);
CREATE INDEX idx_company_expenses_amount ON company_expenses(amount);

-- RLS 정책 설정
ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "company_expenses_select_all" ON company_expenses
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "company_expenses_insert_staff" ON company_expenses
    FOR INSERT
    WITH CHECK (true);

-- 스태프만 수정 가능
CREATE POLICY "company_expenses_update_staff" ON company_expenses
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 스태프만 삭제 가능
CREATE POLICY "company_expenses_delete_staff" ON company_expenses
    FOR DELETE
    USING (true);

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_company_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_expenses_updated_at
    BEFORE UPDATE ON company_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_company_expenses_updated_at();

-- 회계 기간 자동 설정 함수
CREATE OR REPLACE FUNCTION set_accounting_period()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.accounting_period IS NULL THEN
        NEW.accounting_period = TO_CHAR(NEW.submit_on, 'YYYY-MM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_accounting_period
    BEFORE INSERT ON company_expenses
    FOR EACH ROW
    EXECUTE FUNCTION set_accounting_period();

commit;
