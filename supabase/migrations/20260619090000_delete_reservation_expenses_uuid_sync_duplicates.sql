-- 시트 동기화 시 id가 비어 있으면 UUID가 붙어 매번 새 행이 쌓인 예약 지출 정리.
-- 원본 시트 ID는 숫자/짧은 문자열이므로, 표준 UUID(8-4-4-4-12) 형태이면서
-- 명세 줄과 연결되지 않은 행(statement_line_id IS NULL)만 삭제한다.
-- (명세 보정/일괄 반영 UI는 crypto.randomUUID + statement_line_id 를 쓰므로 보존됨.)
-- partner_fund_transactions(reservation_expenses:<id>)는 reservation_expenses DELETE 트리거로 함께 정리됨.

begin;

with doomed as (
  select re.id
  from public.reservation_expenses re
  where re.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and re.statement_line_id is null
)
delete from public.reconciliation_matches rm
using doomed d
where rm.source_table = 'reservation_expenses'
  and rm.source_id = d.id;

delete from public.reservation_expenses re
where re.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and re.statement_line_id is null;

commit;
