-- 기존 명세 줄 direction 반전만 수행 (CSV 가져오기 설정은 건드리지 않음)
-- 이전 버전 RPC가 financial_accounts 를 invert 로 바꾸던 동작을 제거합니다.

begin;

create or replace function public.flip_statement_lines_and_set_csv_invert(p_financial_account_id text)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_flipped bigint;
begin
  if p_financial_account_id is null or length(trim(p_financial_account_id)) = 0 then
    raise exception 'invalid_financial_account_id';
  end if;

  if not exists (select 1 from public.financial_accounts fa where fa.id = p_financial_account_id) then
    raise exception 'financial_account_not_found';
  end if;

  update public.statement_lines sl
  set
    direction = case sl.direction
      when 'outflow' then 'inflow'
      when 'inflow' then 'outflow'
    end,
    updated_at = now()
  from public.statement_imports si
  where sl.statement_import_id = si.id
    and si.financial_account_id = p_financial_account_id;

  get diagnostics v_flipped = row_count;

  return v_flipped;
end;
$$;

comment on function public.flip_statement_lines_and_set_csv_invert(text) is
  '해당 금융 계정에 연결된 명세 줄의 direction 만 outflow/inflow 반전합니다. CSV 가져오기 설정은 변경하지 않습니다.';

commit;
