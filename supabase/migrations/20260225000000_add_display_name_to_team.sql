-- team 테이블에 display_name 컬럼 추가 (고객 언어 무관 통일 표시명)
-- 2026-02-25

ALTER TABLE public.team ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

COMMENT ON COLUMN public.team.display_name IS '통일 표시명 (봉투·영수증 등에서 고객 언어 무관 사용)';
