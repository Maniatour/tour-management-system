-- 투어 배정 상태 값 업데이트
-- 오피스에서 배정 시 'assigned', 가이드가 확인 시 'confirmed', 거절 시 'rejected' 상태 사용
-- 작성일: 2025-02-09

-- assignment_status 컬럼이 없으면 추가
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'pending';

-- 배정 상태에 대한 설명 업데이트
COMMENT ON COLUMN public.tours.assignment_status IS '투어 배정 현황: pending(대기), assigned(오피스에서 배정됨), confirmed(가이드가 확인함), rejected(가이드가 거절함)';

-- 기존 데이터 정리 (기존 confirmed는 그대로 유지, pending은 그대로 유지)
-- assigned, rejected 상태는 새로 추가되는 상태이므로 기존 데이터는 변경하지 않음




