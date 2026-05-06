-- payment_records.payment_status: Refunded/Returned 및 변형 → 고정 한글
-- 앱은 이후 「환불됨 (우리)」「환불됨 (파트너)」만 저장·조회하도록 통일

-- 1) 파트너 환불 (Returned 계열) — Refund Requested 등과 구분
UPDATE public.payment_records pr
SET payment_status = '환불됨 (파트너)',
    updated_at = COALESCE(pr.updated_at, now())
WHERE pr.payment_status IS NOT NULL
  AND btrim(pr.payment_status) IS DISTINCT FROM '환불됨 (파트너)'
  AND (
    lower(btrim(pr.payment_status)) = 'returned'
    OR btrim(pr.payment_status) = 'Returned'
    OR pr.payment_status ILIKE '%Returned%'
    OR pr.payment_status = 'Returned (파트너가 환불조치)'
    OR pr.payment_status ILIKE '%파트너가 환불%'
  );

-- 2) 우리 쪽 환불 (Refunded 계열) — Refund Requested 는 'Refunded' 부분 문자열이 아니므로 제외됨
UPDATE public.payment_records pr
SET payment_status = '환불됨 (우리)',
    updated_at = COALESCE(pr.updated_at, now())
WHERE pr.payment_status IS NOT NULL
  AND btrim(pr.payment_status) IS DISTINCT FROM '환불됨 (우리)'
  AND (
    lower(btrim(pr.payment_status)) = 'refunded'
    OR btrim(pr.payment_status) = 'Refunded'
    OR pr.payment_status ILIKE '%Refunded%'
    OR pr.payment_status = 'Refunded (우리 쪽에서 환불조치)'
    OR pr.payment_status ILIKE '%우리 쪽에서 환불%'
  );
