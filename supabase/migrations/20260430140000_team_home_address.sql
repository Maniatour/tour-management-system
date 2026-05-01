-- 직원 자택 주소 (팀원 정보 수정 폼에서 저장)
ALTER TABLE public.team
  ADD COLUMN IF NOT EXISTS home_address text;

COMMENT ON COLUMN public.team.home_address IS '직원 자택(집) 주소';
