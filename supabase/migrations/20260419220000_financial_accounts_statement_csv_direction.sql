-- Per-account override for statement CSV debit/credit (outflow vs inflow) interpretation.
-- Many Amex exports use bank-style signs (negative or parentheses = purchase); the app previously
-- inverted all credit_card imports, which flips those rows the wrong way.

begin;

alter table public.financial_accounts
  add column if not exists statement_csv_direction_mode text not null default 'auto';

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.financial_accounts'::regclass
      and conname = 'financial_accounts_statement_csv_direction_mode_check'
  ) then
    alter table public.financial_accounts
      add constraint financial_accounts_statement_csv_direction_mode_check
      check (statement_csv_direction_mode in ('auto', 'invert', 'no_invert'));
  end if;
end
$migration$;

comment on column public.financial_accounts.statement_csv_direction_mode is
  'Statement CSV row direction after parsing signed Amount: auto = flip when account_type is credit_card; invert = always flip; no_invert = never flip (e.g. Amex negative=purchase).';

commit;
