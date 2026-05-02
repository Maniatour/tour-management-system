-- 이전 버전 마이그레이션에서 standard_leaf_id에 FK를 건 경우 해제 (카테고리 시드 불일치 시 PATCH 400/23503 방지)
begin;

alter table public.statement_expense_autofill_rules
  drop constraint if exists statement_expense_autofill_rules_standard_leaf_id_fkey;

commit;
