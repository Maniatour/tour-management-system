-- 현금 관리에서 직접 추가한 거래의 결제처(paid_to)
alter table public.cash_transactions
  add column if not exists paid_to text;

comment on column public.cash_transactions.paid_to is
  'Payee / vendor for a cash transaction entered in cash management.';

create index if not exists idx_cash_transactions_paid_to
  on public.cash_transactions (paid_to);

-- 기존 관행: 설명란에 결제처를 넣음. 은행 Deposit 은 제외.
update public.cash_transactions
set paid_to = nullif(btrim(description), '')
where paid_to is null
  and description is not null
  and btrim(description) <> ''
  and description not ilike '%은행 Deposit%';
