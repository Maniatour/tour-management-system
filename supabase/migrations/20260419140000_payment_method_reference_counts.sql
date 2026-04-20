-- payment_method 문자열이 참조되는 모든 테이블에서 ID별 행 수 집계 (결제 방법 관리·정리용)
begin;

CREATE OR REPLACE FUNCTION public.payment_method_reference_counts()
RETURNS TABLE (
  payment_method text,
  reference_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.trimmed AS payment_method, COUNT(*)::bigint AS reference_count
  FROM (
    SELECT trim(both from pr.payment_method) AS trimmed
    FROM payment_records pr
    WHERE pr.payment_method IS NOT NULL AND length(trim(both from pr.payment_method)) > 0
    UNION ALL
    SELECT trim(both from ce.payment_method) AS trimmed
    FROM company_expenses ce
    WHERE ce.payment_method IS NOT NULL AND length(trim(both from ce.payment_method)) > 0
    UNION ALL
    SELECT trim(both from re.payment_method) AS trimmed
    FROM reservation_expenses re
    WHERE re.payment_method IS NOT NULL AND length(trim(both from re.payment_method)) > 0
    UNION ALL
    SELECT trim(both from te.payment_method) AS trimmed
    FROM tour_expenses te
    WHERE te.payment_method IS NOT NULL AND length(trim(both from te.payment_method)) > 0
    UNION ALL
    SELECT trim(both from tb.payment_method) AS trimmed
    FROM ticket_bookings tb
    WHERE tb.payment_method IS NOT NULL AND length(trim(both from tb.payment_method)) > 0
    UNION ALL
    SELECT trim(both from hb.payment_method) AS trimmed
    FROM tour_hotel_bookings hb
    WHERE hb.payment_method IS NOT NULL AND length(trim(both from hb.payment_method)) > 0
  ) u
  GROUP BY u.trimmed;
$$;

COMMENT ON FUNCTION public.payment_method_reference_counts() IS
  '결제·지출·부킹 등 payment_method 컬럼에 저장된 값(trim)별 총 참조 행 수. 서비스 롤 API에서만 호출.';

REVOKE ALL ON FUNCTION public.payment_method_reference_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_method_reference_counts() TO service_role;

commit;
