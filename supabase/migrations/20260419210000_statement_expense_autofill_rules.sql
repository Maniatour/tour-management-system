-- 명세 줄 → 회사 지출 일괄 입력용 규칙(템플릿·학습 저장)
begin;

create table if not exists public.statement_expense_autofill_rules (
  id text primary key default gen_random_uuid()::text,
  financial_account_id text references public.financial_accounts (id) on delete cascade,
  pattern text not null,
  match_mode text not null default 'contains' check (match_mode in ('contains', 'startswith')),
  paid_to text not null default '',
  paid_for text not null,
  category text not null,
  priority integer not null default 0,
  source text not null default 'template' check (source in ('template', 'learned')),
  usage_count integer not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.statement_expense_autofill_rules is
  '명세 설명/가맹점 문자열에 매칭해 회사 지출 paid_for·category 등을 채우는 규칙. financial_account_id null이면 모든 금융 계정에 적용.';

create index if not exists idx_statement_expense_autofill_rules_account
  on public.statement_expense_autofill_rules (financial_account_id);

create index if not exists idx_statement_expense_autofill_rules_priority
  on public.statement_expense_autofill_rules (priority desc);

-- 계정별 규칙: 동일 패턴(대소문자 무시·trim) 중복 방지
create unique index if not exists idx_statement_expense_autofill_rules_acct_pattern
  on public.statement_expense_autofill_rules (financial_account_id, lower(trim(pattern)))
  where financial_account_id is not null;

-- 전역 규칙
create unique index if not exists idx_statement_expense_autofill_rules_global_pattern
  on public.statement_expense_autofill_rules (lower(trim(pattern)))
  where financial_account_id is null;

alter table public.statement_expense_autofill_rules enable row level security;

drop policy if exists "statement_expense_autofill_rules_select" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_insert" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_update" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_delete" on public.statement_expense_autofill_rules;

create policy "statement_expense_autofill_rules_select"
  on public.statement_expense_autofill_rules for select to authenticated using (true);

create policy "statement_expense_autofill_rules_insert"
  on public.statement_expense_autofill_rules for insert to authenticated with check (true);

create policy "statement_expense_autofill_rules_update"
  on public.statement_expense_autofill_rules for update to authenticated using (true) with check (true);

create policy "statement_expense_autofill_rules_delete"
  on public.statement_expense_autofill_rules for delete to authenticated using (true);

drop trigger if exists trg_statement_expense_autofill_rules_updated on public.statement_expense_autofill_rules;
create trigger trg_statement_expense_autofill_rules_updated
  before update on public.statement_expense_autofill_rules
  for each row execute function public.touch_financial_accounts_updated_at();

grant select, insert, update, delete on table public.statement_expense_autofill_rules to authenticated;
grant select, insert, update, delete on table public.statement_expense_autofill_rules to service_role;

commit;
