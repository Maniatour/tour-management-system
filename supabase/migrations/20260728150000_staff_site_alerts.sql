-- 직원 사이트 접속 알림 (헤더 발송 · 확인/서명 · 히스토리)
CREATE TABLE IF NOT EXISTS public.staff_site_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko text NOT NULL,
  title_en text NOT NULL,
  body_ko text NOT NULL,
  body_en text NOT NULL,
  target_positions text[] NOT NULL DEFAULT '{}',
  requires_signature boolean NOT NULL DEFAULT false,
  sent_as_super boolean NOT NULL DEFAULT false,
  sent_by_email text NOT NULL,
  sent_by_name text,
  display_sender_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_site_alerts_created_at
  ON public.staff_site_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_site_alerts_sent_by_email
  ON public.staff_site_alerts (lower(sent_by_email), created_at DESC);

COMMENT ON TABLE public.staff_site_alerts IS '직원 사이트 접속 시 표시되는 알림 발송 캠페인';

CREATE TABLE IF NOT EXISTS public.staff_site_alert_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.staff_site_alerts(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_user_id uuid,
  recipient_position text,
  acknowledged_at timestamptz,
  signature_text text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_site_alert_recipients_unique UNIQUE (alert_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_staff_site_alert_recipients_alert_id
  ON public.staff_site_alert_recipients (alert_id);

CREATE INDEX IF NOT EXISTS idx_staff_site_alert_recipients_pending
  ON public.staff_site_alert_recipients (lower(recipient_email), created_at DESC)
  WHERE acknowledged_at IS NULL;

COMMENT ON TABLE public.staff_site_alert_recipients IS '직원 사이트 알림 수신·확인·서명 기록';

ALTER TABLE public.staff_site_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_site_alert_recipients ENABLE ROW LEVEL SECURITY;

-- 발송 권한: OP / Office Manager / Super (활성 team)
CREATE OR REPLACE FUNCTION public.staff_site_alert_can_send(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team t
    WHERE lower(t.email) = lower(coalesce(p_email, ''))
      AND t.is_active IS NOT FALSE
      AND (
        lower(coalesce(t.position, '')) = 'super'
        OR lower(coalesce(t.position, '')) LIKE '%manager%'
        OR lower(coalesce(t.position, '')) = 'op'
        OR lower(coalesce(t.position, '')) = 'office'
        OR lower(coalesce(t.position, '')) LIKE '%office%'
      )
  )
  OR lower(coalesce(p_email, '')) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com');
$$;

-- alerts: 발송자·관리자 조회
DROP POLICY IF EXISTS "staff_site_alerts_select_sender" ON public.staff_site_alerts;
CREATE POLICY "staff_site_alerts_select_sender" ON public.staff_site_alerts
  FOR SELECT TO authenticated
  USING (public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "staff_site_alerts_insert_sender" ON public.staff_site_alerts;
CREATE POLICY "staff_site_alerts_insert_sender" ON public.staff_site_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
    AND lower(sent_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "staff_site_alerts_select_recipient" ON public.staff_site_alerts;
CREATE POLICY "staff_site_alerts_select_recipient" ON public.staff_site_alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_site_alert_recipients r
      WHERE r.alert_id = staff_site_alerts.id
        AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- recipients: 본인 pending 조회
DROP POLICY IF EXISTS "staff_site_alert_recipients_select_own" ON public.staff_site_alert_recipients;
CREATE POLICY "staff_site_alert_recipients_select_own" ON public.staff_site_alert_recipients
  FOR SELECT TO authenticated
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "staff_site_alert_recipients_insert_sender" ON public.staff_site_alert_recipients;
CREATE POLICY "staff_site_alert_recipients_insert_sender" ON public.staff_site_alert_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "staff_site_alert_recipients_update_own" ON public.staff_site_alert_recipients;
CREATE POLICY "staff_site_alert_recipients_update_own" ON public.staff_site_alert_recipients
  FOR UPDATE TO authenticated
  USING (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
