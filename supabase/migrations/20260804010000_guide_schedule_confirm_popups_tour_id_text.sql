-- 가이드 스케줄 컨펌: SMS + 사이트 접속 팝업
-- tours.id 는 text 이므로 tour_id 도 text 로 맞춤
CREATE TABLE IF NOT EXISTS public.guide_schedule_confirm_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id text NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_role text NOT NULL DEFAULT 'guide' CHECK (recipient_role IN ('guide', 'assistant')),
  title text NOT NULL,
  site_message_body text NOT NULL,
  sms_body text NOT NULL,
  first_pickup_time text,
  office_arrival_time text,
  sent_by text,
  sms_status text CHECK (sms_status IN ('sent', 'failed', 'skipped')),
  sms_twilio_sid text,
  sms_error text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guide_schedule_confirm_popups_tour_id
  ON public.guide_schedule_confirm_popups (tour_id);

CREATE INDEX IF NOT EXISTS idx_guide_schedule_confirm_popups_recipient_pending
  ON public.guide_schedule_confirm_popups (lower(recipient_email), created_at DESC)
  WHERE acknowledged_at IS NULL;

ALTER TABLE public.guide_schedule_confirm_popups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guide_schedule_confirm_popups FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guide_schedule_confirm_popups TO authenticated;
GRANT ALL ON TABLE public.guide_schedule_confirm_popups TO service_role;

DROP POLICY IF EXISTS "guide_schedule_confirm_popups_select_own" ON public.guide_schedule_confirm_popups;
CREATE POLICY "guide_schedule_confirm_popups_select_own" ON public.guide_schedule_confirm_popups
  FOR SELECT TO authenticated
  USING (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "guide_schedule_confirm_popups_update_ack_own" ON public.guide_schedule_confirm_popups;
CREATE POLICY "guide_schedule_confirm_popups_update_ack_own" ON public.guide_schedule_confirm_popups
  FOR UPDATE TO authenticated
  USING (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "guide_schedule_confirm_popups_admin_all" ON public.guide_schedule_confirm_popups;
CREATE POLICY "guide_schedule_confirm_popups_admin_all" ON public.guide_schedule_confirm_popups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team t
      WHERE lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND t.is_active IS NOT FALSE
        AND (
          lower(coalesce(t.position, '')) LIKE '%admin%'
          OR lower(coalesce(t.position, '')) LIKE '%manager%'
          OR lower(coalesce(t.position, '')) LIKE '%office%'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t
      WHERE lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND t.is_active IS NOT FALSE
        AND (
          lower(coalesce(t.position, '')) LIKE '%admin%'
          OR lower(coalesce(t.position, '')) LIKE '%manager%'
          OR lower(coalesce(t.position, '')) LIKE '%office%'
        )
    )
  );

COMMENT ON TABLE public.guide_schedule_confirm_popups IS '가이드 스케줄 컨펌 SMS·사이트 팝업 발송 기록';
