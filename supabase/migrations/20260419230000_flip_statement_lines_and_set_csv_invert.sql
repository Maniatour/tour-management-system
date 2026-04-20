-- RPC: 금융 계정별 기존 statement_lines 방향 일괄 반전 + CSV 설정을 항상 반전(invert)으로 저장
-- 명세 대조 화면의 "기존 데이터 반전하기" 버튼에서 호출
-- 선행: 20260419220000_financial_accounts_statement_csv_direction.sql (statement_csv_direction_mode 컬럼)

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

  update public.financial_accounts fa
  set
    statement_csv_direction_mode = 'invert',
    updated_at = now()
  where fa.id = p_financial_account_id;

  return v_flipped;
end;
$$;

comment on function public.flip_statement_lines_and_set_csv_invert(text) is
  '해당 금융 계정의 모든 명세 줄 direction 을 반전한 뒤 statement_csv_direction_mode 를 invert 로 고정합니다.';

revoke all on function public.flip_statement_lines_and_set_csv_invert(text) from public;
grant execute on function public.flip_statement_lines_and_set_csv_invert(text) to authenticated;
grant execute on function public.flip_statement_lines_and_set_csv_invert(text) to service_role;

commit;
