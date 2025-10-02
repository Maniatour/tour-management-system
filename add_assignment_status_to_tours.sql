-- 투어 테이블에 배정 현황 필드 추가
ALTER TABLE public.tours 
ADD COLUMN assignment_status text DEFAULT 'pending';

-- 배정 현황에 대한 설명 추가
COMMENT ON COLUMN public.tours.assignment_status IS '투어 배정 현황: pending(대기), confirmed(확정)';

-- 기본값 설정
UPDATE public.tours 
SET assignment_status = 'pending' 
WHERE assignment_status IS NULL;

-- 제약 조건 추가 (선택적)
-- ALTER TABLE public.tours 
-- ADD CONSTRAINT check_assignment_status 
-- CHECK (assignment_status IN ('pending', 'confirmed'));
