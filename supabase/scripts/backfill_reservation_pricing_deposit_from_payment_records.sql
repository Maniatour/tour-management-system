-- reservation_pricing.deposit_amount ← payment_records 집계 (앱: summarizePaymentRecordsForBalance 와 동일)
--
-- 규칙 요약 (src/utils/reservationPricingBalance.ts):
-- 1) 잔금 수령(Balance received 등) → 보증금 버킷에서 제외
-- 2) 보증금 버킷: partner received / deposit received / customer's cc charged (대소문자 무시 부분일치)
--    단 (1)에 해당하면 합산 안 함
-- 3) Partner Received (정확히 일치) → partnerReceivedStrict 별도 합산
-- 4) (2) 이외 & (1) 아님: Refunded → 환불 합, Returned → 반환 합 (else-if 순서)
-- 5) deposit_gross > 0 이면: after = deposit_gross - LEAST(partner_strict, returned), 아니면 deposit_gross
-- 6) deposit_net = GREATEST(0, ROUND(after - refunded, 2))
--
-- 실행 전 백업 권장. 모든 reservation_pricing 행의 deposit_amount 를 갱신합니다 (입금 없으면 0).

WITH
classified AS (
  SELECT
    pr.reservation_id,
    pr.amount::numeric AS amt,
    trim(COALESCE(pr.payment_status, '')) AS ps
  FROM public.payment_records pr
),
flags AS (
  SELECT
    reservation_id,
    amt,
    ps,
    lower(ps) AS psl,
    (ps = 'Partner Received') AS is_partner_strict,
    (lower(ps) = 'balance received' OR lower(ps) LIKE 'balance received%') AS is_balance_rx,
    (
      NOT (lower(ps) = 'balance received' OR lower(ps) LIKE 'balance received%')
      AND (
        lower(ps) LIKE '%partner received%'
        OR lower(ps) LIKE '%deposit received%'
        OR lower(ps) LIKE '%customer''s cc charged%'
      )
    ) AS is_deposit_bucket,
    (
      NOT (lower(ps) = 'balance received' OR lower(ps) LIKE 'balance received%')
      AND NOT (
        lower(ps) LIKE '%partner received%'
        OR lower(ps) LIKE '%deposit received%'
        OR lower(ps) LIKE '%customer''s cc charged%'
      )
      AND (
        ps = '환불됨 (우리)'
        OR ps LIKE '%Refunded%'
        OR lower(ps) = 'refunded'
      )
    ) AS is_refunded,
    (
      NOT (lower(ps) = 'balance received' OR lower(ps) LIKE 'balance received%')
      AND NOT (
        lower(ps) LIKE '%partner received%'
        OR lower(ps) LIKE '%deposit received%'
        OR lower(ps) LIKE '%customer''s cc charged%'
      )
      AND NOT (
        ps = '환불됨 (우리)'
        OR ps LIKE '%Refunded%'
        OR lower(ps) = 'refunded'
      )
      AND (
        ps = '환불됨 (파트너)'
        OR ps LIKE '%Returned%'
        OR lower(ps) = 'returned'
      )
    ) AS is_returned
  FROM classified
),
per_reservation AS (
  SELECT
    reservation_id,
    SUM(CASE WHEN is_partner_strict THEN amt ELSE 0 END) AS partner_strict,
    SUM(CASE WHEN NOT is_balance_rx AND is_deposit_bucket THEN amt ELSE 0 END) AS deposit_gross,
    SUM(CASE WHEN NOT is_balance_rx AND is_refunded THEN amt ELSE 0 END) AS refunded,
    SUM(CASE WHEN NOT is_balance_rx AND is_returned THEN amt ELSE 0 END) AS returned
  FROM flags
  GROUP BY reservation_id
),
deposit_from_payments AS (
  SELECT
    reservation_id,
    GREATEST(
      0::numeric,
      ROUND(
        (
          CASE
            WHEN deposit_gross > 0 THEN
              ROUND((deposit_gross - LEAST(partner_strict, returned))::numeric, 2)
            ELSE deposit_gross
          END
          - refunded
        )::numeric,
        2
      )
    ) AS deposit_net
  FROM per_reservation
),
joined AS (
  SELECT
    rp.id AS pricing_id,
    COALESCE(dfp.deposit_net, 0::numeric) AS new_deposit
  FROM public.reservation_pricing rp
  LEFT JOIN deposit_from_payments dfp ON dfp.reservation_id = rp.reservation_id
)
UPDATE public.reservation_pricing rp
SET
  deposit_amount = j.new_deposit,
  updated_at = NOW()
FROM joined j
WHERE rp.id = j.pricing_id;
