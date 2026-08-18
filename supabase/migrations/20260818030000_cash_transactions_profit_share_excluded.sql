-- 상계: 50/50 Profit Share 계산에서 제외. 현금 잔액에는 그대로 반영.

alter table public.cash_transactions
  add column if not exists profit_share_excluded boolean not null default false;

update public.cash_transactions
set profit_share_excluded = true
where coalesce(trim(offset_paid_to), '') <> '';
