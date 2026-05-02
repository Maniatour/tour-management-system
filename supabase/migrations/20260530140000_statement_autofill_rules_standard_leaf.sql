-- 명세 자동입력 규칙: 선택한 표준 카테고리(리프) id 보존 (동일 category 문자열 충돌 방지)
-- FK 없음: 일부 환경에서 expense_standard_categories 행이 앱과 다를 수 있어 저장 실패(400) 방지
begin;

alter table public.statement_expense_autofill_rules
  add column if not exists standard_leaf_id text;

comment on column public.statement_expense_autofill_rules.standard_leaf_id is
  '회사 지출 표준 카테고리 트리의 리프 id. 있으면 paid_for·category는 이 리프에서 재계산해 적용.';

create index if not exists idx_statement_expense_autofill_rules_standard_leaf
  on public.statement_expense_autofill_rules (standard_leaf_id)
  where standard_leaf_id is not null;

commit;
