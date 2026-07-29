-- 개별 수신자 이메일 목록 (그룹 대신 직원 직접 선택 시)
ALTER TABLE public.staff_site_alerts
  ADD COLUMN IF NOT EXISTS target_individuals text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.staff_site_alerts.target_individuals IS
  '개별 수신자 이메일(소문자). 비어 있으면 target_positions 그룹 확장으로 수신자 결정';
