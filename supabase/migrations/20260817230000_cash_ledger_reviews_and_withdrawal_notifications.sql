-- 현금 거래 내역 승인/비승인/플래그 + 출금 시 info@maniatour.com 알림

begin;

create table if not exists public.cash_ledger_reviews (
  id uuid primary key default gen_random_uuid(),
  source text not null check (
    source in (
      'cash_transactions',
      'payment_records',
      'company_expenses',
      'reservation_expenses'
    )
  ),
  source_id text not null,
  review_status text not null check (review_status in ('approved', 'unapproved', 'flagged')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

comment on table public.cash_ledger_reviews is
  '현금 거래 내역(통합 원장) 행별 승인·비승인·플래그. 행이 없으면 비승인으로 본다.';

create index if not exists idx_cash_ledger_reviews_status
  on public.cash_ledger_reviews (review_status, reviewed_at desc);

alter table public.cash_ledger_reviews enable row level security;

drop policy if exists "cash_ledger_reviews_select_staff" on public.cash_ledger_reviews;
create policy "cash_ledger_reviews_select_staff"
  on public.cash_ledger_reviews
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists "cash_ledger_reviews_insert_staff" on public.cash_ledger_reviews;
create policy "cash_ledger_reviews_insert_staff"
  on public.cash_ledger_reviews
  for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "cash_ledger_reviews_update_staff" on public.cash_ledger_reviews;
create policy "cash_ledger_reviews_update_staff"
  on public.cash_ledger_reviews
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update on public.cash_ledger_reviews to authenticated;

create table if not exists public.cash_withdrawal_notifications (
  id uuid primary key default gen_random_uuid(),
  source text not null check (
    source in (
      'cash_transactions',
      'payment_records',
      'company_expenses',
      'reservation_expenses'
    )
  ),
  source_id text not null,
  recipient_email text not null,
  amount numeric(12, 2) not null default 0,
  transaction_date timestamptz,
  description text,
  category text,
  paid_to text,
  created_by text,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_id, recipient_email)
);

comment on table public.cash_withdrawal_notifications is
  '현금 출금이 추가되면 info@maniatour.com 등 수신자에게 띄우는 인앱 알림.';

create index if not exists idx_cash_withdrawal_notifications_recipient
  on public.cash_withdrawal_notifications (lower(recipient_email), read_at, created_at desc);

alter table public.cash_withdrawal_notifications enable row level security;

drop policy if exists "cash_withdrawal_notifications_select_recipient"
  on public.cash_withdrawal_notifications;
create policy "cash_withdrawal_notifications_select_recipient"
  on public.cash_withdrawal_notifications
  for select
  to authenticated
  using (
    public.is_staff()
    and lower(recipient_email) = public.current_email()
  );

drop policy if exists "cash_withdrawal_notifications_update_recipient"
  on public.cash_withdrawal_notifications;
create policy "cash_withdrawal_notifications_update_recipient"
  on public.cash_withdrawal_notifications
  for update
  to authenticated
  using (
    public.is_staff()
    and lower(recipient_email) = public.current_email()
  )
  with check (
    public.is_staff()
    and lower(recipient_email) = public.current_email()
  );

grant select, update on public.cash_withdrawal_notifications to authenticated;

create or replace function public.is_cash_ledger_payment_method(p_method text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(trim(p_method), '') <> ''
    and (
      lower(trim(p_method)) in ('cash', 'paym032', 'paym001')
      or exists (
        select 1
        from public.payment_methods pm
        where pm.method_type = 'cash'
          and (pm.id = p_method or pm.method = p_method)
      )
    );
$$;

create or replace function public.is_cash_ledger_refund_status(p_status text, p_note text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_status, '') ~* '(환불|refund|returned)'
    or coalesce(p_note, '') ~ '현금[[:space:]]*환불';
$$;

create or replace function public.enqueue_cash_withdrawal_notification(
  p_source text,
  p_source_id text,
  p_amount numeric,
  p_transaction_date timestamptz,
  p_description text,
  p_category text,
  p_paid_to text,
  p_created_by text,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient constant text := 'info@maniatour.com';
  v_actor text;
begin
  v_actor := lower(trim(coalesce(p_actor_email, p_created_by, '')));
  if v_actor = v_recipient then
    return;
  end if;
  if p_source_id is null or btrim(p_source_id) = '' then
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  insert into public.cash_withdrawal_notifications (
    source,
    source_id,
    recipient_email,
    amount,
    transaction_date,
    description,
    category,
    paid_to,
    created_by,
    message
  )
  values (
    p_source,
    p_source_id,
    v_recipient,
    round(p_amount, 2),
    p_transaction_date,
    p_description,
    p_category,
    p_paid_to,
    p_created_by,
    format('현금 출금 $%s가 추가되었습니다.', to_char(round(p_amount, 2), 'FM999999990.00'))
  )
  on conflict (source, source_id, recipient_email) do nothing;
exception
  when others then
    raise warning 'enqueue_cash_withdrawal_notification failed: %', sqlerrm;
end;
$$;

create or replace function public.trg_notify_cash_transaction_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and coalesce(old.transaction_type, '') = 'withdrawal' then
    return new;
  end if;
  if coalesce(new.transaction_type, '') <> 'withdrawal' then
    return new;
  end if;
  perform public.enqueue_cash_withdrawal_notification(
    'cash_transactions',
    new.id::text,
    new.amount,
    new.transaction_date,
    new.description,
    new.category,
    new.paid_to,
    new.created_by,
    public.current_email()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_cash_transaction_withdrawal on public.cash_transactions;
create trigger trg_notify_cash_transaction_withdrawal
  after insert or update of transaction_type
  on public.cash_transactions
  for each row
  execute function public.trg_notify_cash_transaction_withdrawal();

create or replace function public.trg_notify_company_expense_cash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cash_ledger_payment_method(new.payment_method) then
    return new;
  end if;
  perform public.enqueue_cash_withdrawal_notification(
    'company_expenses',
    new.id::text,
    new.amount,
    new.submit_on,
    coalesce(new.description, new.notes),
    new.paid_for,
    new.paid_to,
    new.submit_by,
    public.current_email()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_company_expense_cash on public.company_expenses;
create trigger trg_notify_company_expense_cash
  after insert
  on public.company_expenses
  for each row
  execute function public.trg_notify_company_expense_cash();

create or replace function public.trg_notify_reservation_expense_cash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cash_ledger_payment_method(new.payment_method) then
    return new;
  end if;
  perform public.enqueue_cash_withdrawal_notification(
    'reservation_expenses',
    new.id::text,
    new.amount,
    new.submit_on,
    coalesce(new.note, ''),
    new.paid_for,
    new.paid_to,
    new.submitted_by,
    public.current_email()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_reservation_expense_cash on public.reservation_expenses;
create trigger trg_notify_reservation_expense_cash
  after insert
  on public.reservation_expenses
  for each row
  execute function public.trg_notify_reservation_expense_cash();

create or replace function public.trg_notify_payment_record_cash_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cash_ledger_payment_method(new.payment_method) then
    return new;
  end if;
  if not public.is_cash_ledger_refund_status(new.payment_status, new.note) then
    return new;
  end if;
  perform public.enqueue_cash_withdrawal_notification(
    'payment_records',
    new.id::text,
    abs(coalesce(new.amount, 0)),
    new.submit_on,
    new.note,
    '예약 환불',
    null,
    new.submit_by,
    public.current_email()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_payment_record_cash_refund on public.payment_records;
create trigger trg_notify_payment_record_cash_refund
  after insert
  on public.payment_records
  for each row
  execute function public.trg_notify_payment_record_cash_refund();

do $$
begin
  alter publication supabase_realtime add table public.cash_withdrawal_notifications;
exception
  when duplicate_object then null;
end $$;

commit;
