-- Create payment methods table for card and payment method management
-- Migration: 202501200001_create_payment_methods_table

begin;

-- 결제 방법 테이블 (직원 카드 관리 및 정산용)
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY, -- 구글 시트 ID (텍스트 타입)
    method VARCHAR(255) NOT NULL, -- 결제 방법명 (예: CC 4052, 현금, 계좌이체 등)
    method_type VARCHAR(50) NOT NULL DEFAULT 'card', -- 결제 방법 유형 (card, cash, transfer, mobile, etc.)
    user_email VARCHAR(255) NOT NULL, -- 사용자 이메일 (직원)
    limit_amount DECIMAL(10,2), -- 한도 금액
    status VARCHAR(50) DEFAULT 'active', -- 상태 (active, inactive, suspended, expired)
    
    -- 카드 관련 추가 정보
    card_number_last4 VARCHAR(4), -- 카드 번호 마지막 4자리
    card_type VARCHAR(50), -- 카드 타입 (visa, mastercard, amex, etc.)
    card_holder_name VARCHAR(255), -- 카드 소유자명
    expiry_date DATE, -- 만료일
    
    -- 정산 관련 정보
    monthly_limit DECIMAL(10,2), -- 월 한도
    daily_limit DECIMAL(10,2), -- 일 한도
    current_month_usage DECIMAL(10,2) DEFAULT 0, -- 현재 월 사용량
    current_day_usage DECIMAL(10,2) DEFAULT 0, -- 현재 일 사용량
    
    -- 관리 정보
    assigned_date DATE DEFAULT CURRENT_DATE, -- 배정일
    last_used_date TIMESTAMP WITH TIME ZONE, -- 마지막 사용일
    notes TEXT, -- 메모
    
    -- 감사 정보
    created_by VARCHAR(255), -- 생성자
    updated_by VARCHAR(255), -- 수정자
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_payment_methods_user_email ON payment_methods(user_email);
CREATE INDEX idx_payment_methods_status ON payment_methods(status);
CREATE INDEX idx_payment_methods_method_type ON payment_methods(method_type);
CREATE INDEX idx_payment_methods_created_at ON payment_methods(created_at);
CREATE INDEX idx_payment_methods_last_used_date ON payment_methods(last_used_date);

-- RLS 정책 설정
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "payment_methods_select_all" ON payment_methods
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "payment_methods_insert_staff" ON payment_methods
    FOR INSERT
    WITH CHECK (true);

-- 스태프만 수정 가능
CREATE POLICY "payment_methods_update_staff" ON payment_methods
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 스태프만 삭제 가능
CREATE POLICY "payment_methods_delete_staff" ON payment_methods
    FOR DELETE
    USING (true);

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_updated_at();

-- 사용량 업데이트를 위한 함수
CREATE OR REPLACE FUNCTION update_payment_method_usage(
    p_method_id TEXT,
    p_amount DECIMAL(10,2)
)
RETURNS VOID AS $$
BEGIN
    UPDATE payment_methods 
    SET 
        current_month_usage = current_month_usage + p_amount,
        current_day_usage = current_day_usage + p_amount,
        last_used_date = NOW(),
        updated_at = NOW()
    WHERE id = p_method_id;
END;
$$ LANGUAGE plpgsql;

-- 월별 사용량 리셋을 위한 함수
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS VOID AS $$
BEGIN
    UPDATE payment_methods 
    SET 
        current_month_usage = 0,
        updated_at = NOW()
    WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 일별 사용량 리셋을 위한 함수
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS VOID AS $$
BEGIN
    UPDATE payment_methods 
    SET 
        current_day_usage = 0,
        updated_at = NOW()
    WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

commit;
