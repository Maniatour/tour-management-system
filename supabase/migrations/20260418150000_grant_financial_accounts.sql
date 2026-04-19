-- 금융 계정·명세 대조 관련 테이블에 대한 테이블 레벨 권한 명시
-- (마이그레이션만 적용되고 GRANT가 없으면 authenticated 역할에서 INSERT/SELECT가 거절될 수 있음)
begin;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financial_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statement_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statement_imports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statement_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statement_lines TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reconciliation_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reconciliation_matches TO service_role;

commit;
