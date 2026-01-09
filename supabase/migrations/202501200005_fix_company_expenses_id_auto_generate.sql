-- Fix company_expenses table to auto-generate ID
-- Migration: 202501200005_fix_company_expenses_id_auto_generate.sql

begin;

-- ID 컬럼에 자동 생성 기본값 추가
ALTER TABLE company_expenses 
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 기존 NULL ID가 있는 경우 업데이트
UPDATE company_expenses 
SET id = gen_random_uuid()::text 
WHERE id IS NULL OR id = '';

-- ID 컬럼을 NOT NULL로 설정
ALTER TABLE company_expenses 
ALTER COLUMN id SET NOT NULL;

-- 주석 추가
COMMENT ON COLUMN company_expenses.id IS '회사 지출 고유 식별자 (자동 생성 UUID)';

commit;
