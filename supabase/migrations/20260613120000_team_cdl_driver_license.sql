-- CDL(Commercial Driver's License) 보유 여부 — 팀원 정보·가이드 스케줄 표시용
ALTER TABLE public.team
  ADD COLUMN IF NOT EXISTS cdl_driver_license boolean DEFAULT false;

COMMENT ON COLUMN public.team.cdl_driver_license IS 'CDL 운전면허 보유 여부';
