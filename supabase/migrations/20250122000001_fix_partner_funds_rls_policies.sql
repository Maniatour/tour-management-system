-- Fix RLS policies for partner funds tables
-- Migration: 20250122000001_fix_partner_funds_rls_policies.sql
-- Fixes case-insensitive position check and adds super admin email check

begin;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_email text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    -- Check if email is in super admin list
    lower(coalesce(p_email, auth.jwt() ->> 'email', '')) IN (
      'info@maniatour.com', 
      'wooyong.shim09@gmail.com'
    )
    OR
    -- Check if user has Super position in team table
    EXISTS (
      SELECT 1 FROM public.team 
      WHERE lower(email) = lower(coalesce(p_email, auth.jwt() ->> 'email', ''))
      AND is_active = true 
      AND lower(position::text) = 'super'
    )
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "partner_fund_transactions_select_super" ON partner_fund_transactions;
DROP POLICY IF EXISTS "partner_fund_transactions_insert_super" ON partner_fund_transactions;
DROP POLICY IF EXISTS "partner_fund_transactions_update_super" ON partner_fund_transactions;
DROP POLICY IF EXISTS "partner_fund_transactions_delete_super" ON partner_fund_transactions;

DROP POLICY IF EXISTS "partner_loans_select_super" ON partner_loans;
DROP POLICY IF EXISTS "partner_loans_insert_super" ON partner_loans;
DROP POLICY IF EXISTS "partner_loans_update_super" ON partner_loans;
DROP POLICY IF EXISTS "partner_loans_delete_super" ON partner_loans;

DROP POLICY IF EXISTS "partner_loan_payments_select_super" ON partner_loan_payments;
DROP POLICY IF EXISTS "partner_loan_payments_insert_super" ON partner_loan_payments;
DROP POLICY IF EXISTS "partner_loan_payments_update_super" ON partner_loan_payments;
DROP POLICY IF EXISTS "partner_loan_payments_delete_super" ON partner_loan_payments;

-- 파트너 자금 거래 RLS 정책 (수정된 버전)
CREATE POLICY "partner_fund_transactions_select_super" ON partner_fund_transactions
    FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "partner_fund_transactions_insert_super" ON partner_fund_transactions
    FOR INSERT
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_fund_transactions_update_super" ON partner_fund_transactions
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_fund_transactions_delete_super" ON partner_fund_transactions
    FOR DELETE
    USING (public.is_super_admin());

-- 파트너 대출 RLS 정책 (수정된 버전)
CREATE POLICY "partner_loans_select_super" ON partner_loans
    FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "partner_loans_insert_super" ON partner_loans
    FOR INSERT
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_loans_update_super" ON partner_loans
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_loans_delete_super" ON partner_loans
    FOR DELETE
    USING (public.is_super_admin());

-- 파트너 대출 상환 RLS 정책 (수정된 버전)
CREATE POLICY "partner_loan_payments_select_super" ON partner_loan_payments
    FOR SELECT
    USING (public.is_super_admin());

CREATE POLICY "partner_loan_payments_insert_super" ON partner_loan_payments
    FOR INSERT
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_loan_payments_update_super" ON partner_loan_payments
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "partner_loan_payments_delete_super" ON partner_loan_payments
    FOR DELETE
    USING (public.is_super_admin());

commit;
