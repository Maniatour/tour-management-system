-- Create partner funds management tables
-- Migration: 20250122000000_create_partner_funds_tables.sql

begin;

-- 파트너 자금 거래 테이블 (파트너 간 자금 입출금 기록)
CREATE TABLE IF NOT EXISTS partner_fund_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- 거래일시
    partner VARCHAR(20) NOT NULL CHECK (partner IN ('partner1', 'partner2')), -- 파트너 (partner1 또는 partner2)
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')), -- 거래 유형 (입금, 출금)
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- 금액
    description TEXT NOT NULL, -- 거래 설명
    notes TEXT, -- 메모
    created_by VARCHAR(255) NOT NULL, -- 생성자 (user email)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 파트너 대출 테이블 (개인 대출 정보)
CREATE TABLE IF NOT EXISTS partner_loans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    partner VARCHAR(20) NOT NULL CHECK (partner IN ('partner1', 'partner2')), -- 파트너
    loan_name VARCHAR(255) NOT NULL, -- 대출명
    initial_amount DECIMAL(10,2) NOT NULL CHECK (initial_amount > 0), -- 초기 대출 금액
    current_balance DECIMAL(10,2) NOT NULL CHECK (current_balance >= 0), -- 현재 잔액
    interest_rate DECIMAL(5,2) DEFAULT 0, -- 이자율 (%)
    start_date DATE NOT NULL, -- 대출 시작일
    due_date DATE, -- 만기일
    lender VARCHAR(255), -- 대출 기관/개인
    notes TEXT, -- 메모
    created_by VARCHAR(255) NOT NULL, -- 생성자
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 파트너 대출 상환 기록 테이블
CREATE TABLE IF NOT EXISTS partner_loan_payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    loan_id TEXT NOT NULL REFERENCES partner_loans(id) ON DELETE CASCADE, -- 대출 ID
    payment_date DATE NOT NULL, -- 상환일
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- 상환 금액
    notes TEXT, -- 메모
    created_by VARCHAR(255) NOT NULL, -- 생성자
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_partner_fund_transactions_date ON partner_fund_transactions(transaction_date);
CREATE INDEX idx_partner_fund_transactions_partner ON partner_fund_transactions(partner);
CREATE INDEX idx_partner_fund_transactions_type ON partner_fund_transactions(transaction_type);
CREATE INDEX idx_partner_loans_partner ON partner_loans(partner);
CREATE INDEX idx_partner_loan_payments_loan_id ON partner_loan_payments(loan_id);
CREATE INDEX idx_partner_loan_payments_date ON partner_loan_payments(payment_date);

-- RLS 정책 설정
ALTER TABLE partner_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_loan_payments ENABLE ROW LEVEL SECURITY;

-- Super 권한만 접근 가능하도록 RLS 정책 설정
-- Super는 team 테이블에서 position = 'Super'인 사용자

-- 파트너 자금 거래 RLS 정책
CREATE POLICY "partner_fund_transactions_select_super" ON partner_fund_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_fund_transactions_insert_super" ON partner_fund_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_fund_transactions_update_super" ON partner_fund_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_fund_transactions_delete_super" ON partner_fund_transactions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

-- 파트너 대출 RLS 정책
CREATE POLICY "partner_loans_select_super" ON partner_loans
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loans_insert_super" ON partner_loans
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loans_update_super" ON partner_loans
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loans_delete_super" ON partner_loans
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

-- 파트너 대출 상환 RLS 정책
CREATE POLICY "partner_loan_payments_select_super" ON partner_loan_payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loan_payments_insert_super" ON partner_loan_payments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loan_payments_update_super" ON partner_loan_payments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

CREATE POLICY "partner_loan_payments_delete_super" ON partner_loan_payments
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE lower(email) = lower(auth.jwt() ->> 'email')
            AND is_active = true 
            AND position = 'Super'
        )
    );

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_partner_fund_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partner_fund_transactions_updated_at
    BEFORE UPDATE ON partner_fund_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_fund_transactions_updated_at();

CREATE OR REPLACE FUNCTION update_partner_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partner_loans_updated_at
    BEFORE UPDATE ON partner_loans
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_loans_updated_at();

-- 대출 상환 시 current_balance 업데이트 트리거
CREATE OR REPLACE FUNCTION update_loan_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE partner_loans
    SET current_balance = GREATEST(0, current_balance - NEW.amount),
        updated_at = NOW()
    WHERE id = NEW.loan_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_loan_balance_on_payment
    AFTER INSERT ON partner_loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_on_payment();

-- 대출 상환 삭제 시 current_balance 복원 트리거
CREATE OR REPLACE FUNCTION restore_loan_balance_on_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE partner_loans
    SET current_balance = current_balance + OLD.amount,
        updated_at = NOW()
    WHERE id = OLD.loan_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restore_loan_balance_on_payment_delete
    AFTER DELETE ON partner_loan_payments
    FOR EACH ROW
    EXECUTE FUNCTION restore_loan_balance_on_payment_delete();

commit;
