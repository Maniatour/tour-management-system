-- 표준 카테고리에서 도출한 표준 결제내용(원문 paid_for와 별도 보관)
begin;

alter table public.company_expenses
  add column if not exists standard_paid_for text;

comment on column public.company_expenses.standard_paid_for is
  '카테고리 매니저 표준 리프 기준 표준 결제내용. 원문 paid_for는 사용자 입력·이력 보존용으로 유지합니다.';

commit;
