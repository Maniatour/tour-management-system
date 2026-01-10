-- Add Erica as partner3 to partner funds tables
-- Migration: 20250122000003_add_erica_partner.sql

begin;

-- partner_fund_transactions 테이블의 partner CHECK 제약조건 수정
ALTER TABLE partner_fund_transactions
DROP CONSTRAINT IF EXISTS partner_fund_transactions_partner_check;

ALTER TABLE partner_fund_transactions
ADD CONSTRAINT partner_fund_transactions_partner_check 
CHECK (partner IN ('partner1', 'partner2', 'erica'));

-- partner_loans 테이블의 partner CHECK 제약조건 수정 (혹시 사용 중이라면)
ALTER TABLE partner_loans
DROP CONSTRAINT IF EXISTS partner_loans_partner_check;

ALTER TABLE partner_loans
ADD CONSTRAINT partner_loans_partner_check 
CHECK (partner IN ('partner1', 'partner2', 'erica'));

commit;
