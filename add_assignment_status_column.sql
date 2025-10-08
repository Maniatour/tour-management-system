-- 투어 테이블에 배정 상태 컬럼 추가
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'pending';

-- 배정 상태에 대한 설명 추가
COMMENT ON COLUMN public.tours.assignment_status IS '투어 배정 현황: pending(대기), confirm(확정)';

-- 기본값 설정
UPDATE public.tours 
SET assignment_status = 'pending' 
WHERE assignment_status IS NULL;
