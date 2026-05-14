-- customers.archive + reservations.archive
-- 1) 컬럼 보강: 기존 DB에 `archived`(중간 마이그레이션)만 있으면 `archive`로 이관 후 제거
-- 2) 비삭제 예약 기준 최근 투어일이 2024-12-31 이하인 고객 → 고객·해당 고객의 모든 예약 archive=true
-- 3) 예약 관리 검색: `adminReservationListFetch` — 비보관 고객 id 먼저, 없으면 보관만 2차 조회

BEGIN;

-- 고객: archive (이미 있으면 유지)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;

-- 과거 `archived` 컬럼만 적용된 환경 호환
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'archived'
  ) THEN
    UPDATE public.customers
    SET archive = (COALESCE(archive, false) OR COALESCE(archived, false));
    ALTER TABLE public.customers DROP COLUMN archived;
  END IF;
END $$;

UPDATE public.customers SET archive = COALESCE(archive, false) WHERE archive IS NULL;
ALTER TABLE public.customers ALTER COLUMN archive SET DEFAULT false;
ALTER TABLE public.customers ALTER COLUMN archive SET NOT NULL;

COMMENT ON COLUMN public.customers.archive IS
  'true: 보관. 예약 관리 검색은 비보관 고객 매칭이 없을 때만 보관 고객 id를 조회에 사용.';

-- 예약: 동일 플래그(목록·검색에서 필터링할 때 사용 가능)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;

UPDATE public.reservations SET archive = COALESCE(archive, false) WHERE archive IS NULL;
ALTER TABLE public.reservations ALTER COLUMN archive SET DEFAULT false;
ALTER TABLE public.reservations ALTER COLUMN archive SET NOT NULL;

COMMENT ON COLUMN public.reservations.archive IS
  'true: 보관(스테일 묶음). 고객 archive 정책과 함께 일괄 표시.';

-- 비삭제 예약만으로 고객별 MAX(tour_date) <= 2024-12-31 인 고객 → 예약·고객 archive
-- (임시 테이블 미사용: SQL 편집기가 문장별/연결별로 나누어 실행할 때도 동작하도록 UPDATE 각각에 동일 서브쿼리 인라인)
UPDATE public.reservations r
SET archive = true
WHERE r.customer_id::text IN (
  SELECT per.cid
  FROM (
    SELECT
      r2.customer_id::text AS cid,
      MAX(r2.tour_date::date) AS last_tour
    FROM public.reservations r2
    WHERE r2.status IS DISTINCT FROM 'deleted'
      AND r2.customer_id IS NOT NULL
      AND NULLIF(btrim(r2.customer_id::text), '') IS NOT NULL
      AND r2.tour_date IS NOT NULL
    GROUP BY r2.customer_id
  ) per
  WHERE per.last_tour <= DATE '2024-12-31'
);

UPDATE public.customers c
SET archive = true
WHERE c.id::text IN (
  SELECT per.cid
  FROM (
    SELECT
      r2.customer_id::text AS cid,
      MAX(r2.tour_date::date) AS last_tour
    FROM public.reservations r2
    WHERE r2.status IS DISTINCT FROM 'deleted'
      AND r2.customer_id IS NOT NULL
      AND NULLIF(btrim(r2.customer_id::text), '') IS NOT NULL
      AND r2.tour_date IS NOT NULL
    GROUP BY r2.customer_id
  ) per
  WHERE per.last_tour <= DATE '2024-12-31'
);

COMMIT;
