-- 은행 Deposit 현금 거래 ↔ Wells Fargo ATM Receipt 메일(reservation_imports)

alter table public.cash_transactions
  add column if not exists atm_receipt_import_id uuid
    references public.reservation_imports (id) on delete set null;

comment on column public.cash_transactions.atm_receipt_import_id is
  'Wells Fargo ATM Receipt email in reservation_imports, linked like Zelle attachments.';

create unique index if not exists idx_cash_transactions_atm_receipt_import_id
  on public.cash_transactions (atm_receipt_import_id)
  where atm_receipt_import_id is not null;
