-- Create cash transactions table for cash management
-- Migration: 20250121000001_create_cash_transactions_table.sql

begin;

-- 현금 거래 테이블 (현금 입출금 관리)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- 거래일시
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')), -- 거래 유형 (입금, 출금)
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- 금액
    description TEXT, -- 거래 설명
    category VARCHAR(100), -- 카테고리
    reference_type VARCHAR(50), -- 참조 유형 (expense, reservation, tour, etc.)
    reference_id TEXT, -- 참조 ID (expense_id, reservation_id, tour_id, etc.)
    created_by VARCHAR(255) NOT NULL, -- 생성자 (user email)
    notes TEXT, -- 메모
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);
CREATE INDEX idx_cash_transactions_type ON cash_transactions(transaction_type);
CREATE INDEX idx_cash_transactions_category ON cash_transactions(category);
CREATE INDEX idx_cash_transactions_reference ON cash_transactions(reference_type, reference_id);
CREATE INDEX idx_cash_transactions_created_at ON cash_transactions(created_at);

-- RLS 정책 설정
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "cash_transactions_select_all" ON cash_transactions
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "cash_transactions_insert_staff" ON cash_transactions
    FOR INSERT
    WITH CHECK (true);

-- 스태프만 수정 가능
CREATE POLICY "cash_transactions_update_staff" ON cash_transactions
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 스태프만 삭제 가능
CREATE POLICY "cash_transactions_delete_staff" ON cash_transactions
    FOR DELETE
    USING (true);

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_cash_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cash_transactions_updated_at
    BEFORE UPDATE ON cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_cash_transactions_updated_at();

-- 현금 잔액 뷰 생성 (거래 내역을 기반으로 현재 잔액 계산)
CREATE OR REPLACE VIEW cash_balance AS
SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) AS balance
FROM cash_transactions;

commit;
