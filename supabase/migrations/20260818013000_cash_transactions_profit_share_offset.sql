-- Profit Share 현금 출금의 상대방 상계(카드·송금 등). 현금 잔액에는 넣지 않고 50/50 계산에만 사용.

alter table public.cash_transactions
  add column if not exists offset_paid_to text,
  add column if not exists offset_amount numeric(12, 2),
  add column if not exists offset_method text;

alter table public.cash_transactions
  drop constraint if exists cash_transactions_offset_method_check;

alter table public.cash_transactions
  add constraint cash_transactions_offset_method_check
  check (
    offset_method is null
    or offset_method in ('card', 'transfer', 'other')
  );
