-- Chad/Joey 합산 기재를 개인 몫으로 나눌 때 사용. 현금 잔액은 합계 그대로, 50/50 계산만 분할.

alter table public.cash_transactions
  add column if not exists share_chad_amount numeric(12, 2),
  add column if not exists share_joey_amount numeric(12, 2);
