-- 회사 지출(company_expenses): 체크류 결제방법 → WellsFargo 로 통일, 기존 결제방법은 notes 에 보존
--
-- 대상 (대소문자 무시):
--   - 정확히 "check"
--   - "Check #2377" 처럼 check 뒤에 공백·# 이 오는 형태
--   - "CK #2388" 처럼 CK 뒤에 공백·# 이 오는 형태
--
-- 사용법:
--   1) 아래 PREVIEW 만 먼저 실행해 건수·내용을 확인한다.
--   2) 문제없으면 PREVIEW 아래 TRANSACTION 블록을 통째로 실행한다.
--      되돌리려면 COMMIT 대신 ROLLBACK 으로 바꾼 뒤 실행한다.

-- ========== PREVIEW ==========
SELECT id, payment_method, notes, paid_to, paid_for, amount, submit_on
FROM public.company_expenses
WHERE payment_method IS NOT NULL
  AND btrim(payment_method) <> ''
  AND (
    lower(btrim(payment_method)) = 'check'
    OR payment_method ~* '^\s*check\s*#'
    OR payment_method ~* '^\s*ck\s*#'
  )
ORDER BY submit_on DESC NULLS LAST;

-- ========== TRANSACTION (미리보기 확인 후 실행) ==========
BEGIN;

UPDATE public.company_expenses
SET
  notes = CASE
    WHEN notes IS NULL OR btrim(COALESCE(notes, '')) = ''
      THEN '이전 결제방법: ' || payment_method
    ELSE btrim(notes) || E'\n이전 결제방법: ' || payment_method
  END,
  payment_method = 'WellsFargo',
  updated_at = NOW()
WHERE payment_method IS NOT NULL
  AND btrim(payment_method) <> ''
  AND (
    lower(btrim(payment_method)) = 'check'
    OR payment_method ~* '^\s*check\s*#'
    OR payment_method ~* '^\s*ck\s*#'
  );

-- 갱신 건수 확인 (선택)
-- SELECT COUNT(*) FROM public.company_expenses WHERE payment_method = 'WellsFargo' AND notes LIKE '%이전 결제방법:%';

COMMIT;
-- ROLLBACK;
