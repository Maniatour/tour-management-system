-- 운영팀이 예약 Follow-up 파이프라인에서 게스트 거주 확인 진행 여부를 조회할 수 있도록 SELECT 허용

DROP POLICY IF EXISTS "Team active can select resident_check_tokens" ON public.resident_check_tokens;
CREATE POLICY "Team active can select resident_check_tokens"
ON public.resident_check_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team
    WHERE team.email = (auth.jwt() ->> 'email')
      AND COALESCE(team.is_active, true) = true
  )
);

DROP POLICY IF EXISTS "Team active can select resident_check_submissions" ON public.resident_check_submissions;
CREATE POLICY "Team active can select resident_check_submissions"
ON public.resident_check_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team
    WHERE team.email = (auth.jwt() ->> 'email')
      AND COALESCE(team.is_active, true) = true
  )
);
