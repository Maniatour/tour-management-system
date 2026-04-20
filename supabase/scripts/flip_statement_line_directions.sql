-- statement_lines.direction 반전 (outflow <-> inflow)
-- CSV 부호 해석 오류로 이미 적재된 명세 행을 한 번에 고칠 때 사용합니다.
--
-- 주의:
-- - 대조(reconciliation_matches)는 statement_line_id 로 묶여 있으므로 FK 는 유지됩니다.
--   다만 금액·방향 의미가 바뀌므로 매칭이 맞는지 화면에서 다시 확인하는 것이 좋습니다.
-- - dedupe_key 는 가져올 때 direction 을 포함해 만들어진 값입니다. 이 스크립트는 direction 만 바꿉니다.
--   동일 CSV 를 같은 import 에 다시 넣지 않는 한 보통 문제 없습니다. 재가져오기가 더 깔끔하면 해당 import 삭제 후 UI 로 다시 가져오세요.
--
-- 사용법:
-- 1) 아래 financial_account_id 에 금융 계정 UUID 를 넣거나, "이름으로 반전" 블록을 사용하세요.
-- 2) 먼저 SELECT(미리보기) 로 건수·샘플을 확인합니다.
-- 3) UPDATE 를 실행합니다. (선택) statement_imports 기간으로 범위를 줄이려면 AND 절을 풀어 쓰세요.
-- 4) 여러 문을 한꺼번에 돌릴 때는 begin; ... commit; 또는 한 문씩 실행해도 됩니다.

-- ===== 미리보기: 반전 대상 행 수 =====
select count(*) as rows_to_flip
from public.statement_lines sl
inner join public.statement_imports si on si.id = sl.statement_import_id
where si.financial_account_id = '여기에_financial_accounts.id_UUID'
  -- and si.id = '특정_statement_imports.id_만_반전할_때'
  -- and si.period_start >= '2026-01-01'
  -- and si.period_end <= '2026-12-31'
;

-- 샘플 30건
select
  sl.id,
  sl.posted_date,
  sl.amount,
  sl.direction as direction_before,
  case sl.direction
    when 'outflow' then 'inflow'
    when 'inflow' then 'outflow'
  end as direction_after,
  left(coalesce(sl.description, ''), 80) as description
from public.statement_lines sl
inner join public.statement_imports si on si.id = sl.statement_import_id
where si.financial_account_id = '여기에_financial_accounts.id_UUID'
order by sl.posted_date desc, sl.id
limit 30;

-- ===== 실제 반전 (계정 id 지정) =====
-- financial_account_id 를 채운 뒤 주석을 해제하고 실행하세요.

/*
update public.statement_lines sl
set
  direction = case sl.direction
    when 'outflow' then 'inflow'
    when 'inflow' then 'outflow'
  end,
  updated_at = now()
from public.statement_imports si
where sl.statement_import_id = si.id
  and si.financial_account_id = '여기에_financial_accounts.id_UUID'
  -- and si.id = '특정_statement_imports.id_만'
  -- and si.period_start >= '2026-01-01'
  -- and si.period_end <= '2026-12-31'
;
*/

-- ===== 이름으로 금융 계정 id 찾기 (Bonvoy / MGM 등) =====
/*
select id, name, account_type, statement_csv_direction_mode
from public.financial_accounts
where is_active = true
  and (
    name ilike '%bonvoy%'
    or name ilike '%mgm%'
  )
order by name;
*/

-- ===== 실제 반전 (이름 패턴 — 하나의 계정만 매칭되는지 꼭 SELECT 로 확인) =====
/*
update public.statement_lines sl
set
  direction = case sl.direction
    when 'outflow' then 'inflow'
    when 'inflow' then 'outflow'
  end,
  updated_at = now()
from public.statement_imports si
where sl.statement_import_id = si.id
  and si.financial_account_id in (
    select fa.id
    from public.financial_accounts fa
    where fa.is_active = true
      and fa.name ilike '%Bonvoy Business Amex%' -- 필요에 맞게 수정
  );
*/
