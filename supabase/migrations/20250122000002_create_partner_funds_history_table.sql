-- Create partner funds transaction history table
-- Migration: 20250122000002_create_partner_funds_history_table.sql

begin;

-- 파트너 자금 거래 수정 히스토리 테이블
CREATE TABLE IF NOT EXISTS partner_fund_transaction_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transaction_id TEXT NOT NULL REFERENCES partner_fund_transactions(id) ON DELETE CASCADE, -- 거래 ID
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted')), -- 액션 유형
    old_values JSONB, -- 이전 값들
    new_values JSONB, -- 새로운 값들
    changed_by VARCHAR(255) NOT NULL, -- 변경자 (user email)
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- 변경일시
);

-- 인덱스 생성
CREATE INDEX idx_partner_fund_transaction_history_transaction_id ON partner_fund_transaction_history(transaction_id);
CREATE INDEX idx_partner_fund_transaction_history_changed_at ON partner_fund_transaction_history(changed_at);
CREATE INDEX idx_partner_fund_transaction_history_changed_by ON partner_fund_transaction_history(changed_by);

-- RLS 정책 설정
ALTER TABLE partner_fund_transaction_history ENABLE ROW LEVEL SECURITY;

-- Super 권한만 접근 가능
CREATE POLICY "partner_fund_transaction_history_select_super" ON partner_fund_transaction_history
    FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "partner_fund_transaction_history_insert_super" ON partner_fund_transaction_history
    FOR INSERT
    WITH CHECK (public.is_super_admin());

-- 거래 생성/수정/삭제 시 히스토리 자동 저장 트리거
CREATE OR REPLACE FUNCTION log_partner_fund_transaction_history()
RETURNS TRIGGER AS $$
DECLARE
    action_type_val VARCHAR(20);
    old_vals JSONB;
    new_vals JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type_val := 'created';
        old_vals := NULL;
        new_vals := jsonb_build_object(
            'transaction_date', NEW.transaction_date,
            'partner', NEW.partner,
            'transaction_type', NEW.transaction_type,
            'amount', NEW.amount,
            'description', NEW.description,
            'notes', NEW.notes
        );
        
        INSERT INTO partner_fund_transaction_history (
            transaction_id,
            action_type,
            old_values,
            new_values,
            changed_by
        ) VALUES (
            NEW.id,
            action_type_val,
            old_vals,
            new_vals,
            NEW.created_by
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type_val := 'updated';
        old_vals := jsonb_build_object(
            'transaction_date', OLD.transaction_date,
            'partner', OLD.partner,
            'transaction_type', OLD.transaction_type,
            'amount', OLD.amount,
            'description', OLD.description,
            'notes', OLD.notes
        );
        new_vals := jsonb_build_object(
            'transaction_date', NEW.transaction_date,
            'partner', NEW.partner,
            'transaction_type', NEW.transaction_type,
            'amount', NEW.amount,
            'description', NEW.description,
            'notes', NEW.notes
        );
        
        INSERT INTO partner_fund_transaction_history (
            transaction_id,
            action_type,
            old_values,
            new_values,
            changed_by
        ) VALUES (
            NEW.id,
            action_type_val,
            old_vals,
            new_vals,
            COALESCE(NEW.updated_by, NEW.created_by, auth.jwt() ->> 'email')
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        action_type_val := 'deleted';
        old_vals := jsonb_build_object(
            'transaction_date', OLD.transaction_date,
            'partner', OLD.partner,
            'transaction_type', OLD.transaction_type,
            'amount', OLD.amount,
            'description', OLD.description,
            'notes', OLD.notes
        );
        
        INSERT INTO partner_fund_transaction_history (
            transaction_id,
            action_type,
            old_values,
            new_values,
            changed_by
        ) VALUES (
            OLD.id,
            action_type_val,
            old_vals,
            NULL,
            COALESCE(OLD.updated_by, OLD.created_by, auth.jwt() ->> 'email')
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_log_partner_fund_transaction_history ON partner_fund_transactions;
CREATE TRIGGER trigger_log_partner_fund_transaction_history
    AFTER INSERT OR UPDATE OR DELETE ON partner_fund_transactions
    FOR EACH ROW
    EXECUTE FUNCTION log_partner_fund_transaction_history();

-- updated_by 컬럼 추가 (없는 경우)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partner_fund_transactions' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE partner_fund_transactions 
        ADD COLUMN updated_by VARCHAR(255);
    END IF;
END $$;

commit;
