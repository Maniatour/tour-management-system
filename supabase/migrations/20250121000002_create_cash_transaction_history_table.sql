-- Create cash transaction history table for tracking modifications
-- Migration: 20250121000002_create_cash_transaction_history_table.sql

begin;

-- 현금 거래 수정 히스토리 테이블
CREATE TABLE IF NOT EXISTS cash_transaction_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_id TEXT NOT NULL, -- 원본 거래 ID
    source_table VARCHAR(50) NOT NULL, -- 출처 테이블 (cash_transactions, payment_records, company_expenses)
    transaction_date TIMESTAMP WITH TIME ZONE,
    transaction_type VARCHAR(20),
    amount DECIMAL(10,2),
    description TEXT,
    category VARCHAR(100),
    notes TEXT,
    modified_by VARCHAR(255) NOT NULL, -- 수정자 (user email)
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- 수정일시
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')), -- 변경 유형
    old_values JSONB, -- 변경 전 값 (JSON 형식)
    new_values JSONB -- 변경 후 값 (JSON 형식)
);

-- 인덱스 생성
CREATE INDEX idx_cash_transaction_history_transaction_id ON cash_transaction_history(transaction_id);
CREATE INDEX idx_cash_transaction_history_source_table ON cash_transaction_history(source_table);
CREATE INDEX idx_cash_transaction_history_modified_at ON cash_transaction_history(modified_at);
CREATE INDEX idx_cash_transaction_history_modified_by ON cash_transaction_history(modified_by);

-- RLS 정책 설정
ALTER TABLE cash_transaction_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "cash_transaction_history_select_all" ON cash_transaction_history
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "cash_transaction_history_insert_staff" ON cash_transaction_history
    FOR INSERT
    WITH CHECK (true);

commit;
