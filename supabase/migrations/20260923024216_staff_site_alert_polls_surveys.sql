-- 사이트 알림에 투표·설문 문항과 응답을 붙인다.
ALTER TABLE public.staff_site_alerts
  ADD COLUMN IF NOT EXISTS interaction_kind text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS interaction_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interaction_show_results boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_site_alerts_interaction_kind_check'
  ) THEN
    ALTER TABLE public.staff_site_alerts
      ADD CONSTRAINT staff_site_alerts_interaction_kind_check
      CHECK (interaction_kind IN ('none', 'poll', 'survey'));
  END IF;
END $$;

COMMENT ON COLUMN public.staff_site_alerts.interaction_kind IS
  'none | poll(단일 투표) | survey(복수 문항 설문)';
COMMENT ON COLUMN public.staff_site_alerts.interaction_anonymous IS
  'true면 발송 내역 UI에 응답자 이름을 표시하지 않는다';
COMMENT ON COLUMN public.staff_site_alerts.interaction_show_results IS
  'true면 응답 직후 수신자에게 객관식 집계를 보여 준다';

CREATE TABLE IF NOT EXISTS public.staff_site_alert_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.staff_site_alerts(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  prompt_ko text NOT NULL,
  prompt_en text NOT NULL DEFAULT '',
  question_type text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  CONSTRAINT staff_site_alert_questions_type_check
    CHECK (question_type IN ('single', 'multiple', 'text')),
  CONSTRAINT staff_site_alert_questions_sort_unique UNIQUE (alert_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_staff_site_alert_questions_alert
  ON public.staff_site_alert_questions (alert_id, sort_order);

COMMENT ON TABLE public.staff_site_alert_questions IS '사이트 알림 투표·설문 문항';

CREATE TABLE IF NOT EXISTS public.staff_site_alert_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.staff_site_alert_questions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  label_ko text NOT NULL,
  label_en text NOT NULL DEFAULT '',
  CONSTRAINT staff_site_alert_options_sort_unique UNIQUE (question_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_staff_site_alert_options_question
  ON public.staff_site_alert_options (question_id, sort_order);

COMMENT ON TABLE public.staff_site_alert_options IS '사이트 알림 투표·설문 보기';

CREATE TABLE IF NOT EXISTS public.staff_site_alert_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.staff_site_alerts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.staff_site_alert_questions(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.staff_site_alert_recipients(id) ON DELETE CASCADE,
  option_ids uuid[] NOT NULL DEFAULT '{}',
  text_answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_site_alert_responses_once UNIQUE (recipient_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_site_alert_responses_alert
  ON public.staff_site_alert_responses (alert_id);

COMMENT ON TABLE public.staff_site_alert_responses IS '사이트 알림 투표·설문 응답. 수신자당 문항 1행';

CREATE OR REPLACE FUNCTION public.staff_site_alert_responses_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  q_type text;
  q_alert uuid;
  option_count integer;
BEGIN
  SELECT q.question_type, q.alert_id
    INTO q_type, q_alert
  FROM public.staff_site_alert_questions q
  WHERE q.id = NEW.question_id;

  IF q_alert IS NULL OR q_alert IS DISTINCT FROM NEW.alert_id THEN
    RAISE EXCEPTION 'invalid question';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_site_alert_recipients r
    WHERE r.id = NEW.recipient_id
      AND r.alert_id = NEW.alert_id
  ) THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;

  IF q_type = 'text' THEN
    IF coalesce(cardinality(NEW.option_ids), 0) > 0 THEN
      RAISE EXCEPTION 'text question cannot have options';
    END IF;
    IF btrim(coalesce(NEW.text_answer, '')) = '' THEN
      RAISE EXCEPTION 'text answer required';
    END IF;
  ELSE
    IF coalesce(cardinality(NEW.option_ids), 0) < 1 THEN
      RAISE EXCEPTION 'choice required';
    END IF;
    IF (
      SELECT count(DISTINCT opt)
      FROM unnest(NEW.option_ids) AS opt
    ) <> cardinality(NEW.option_ids) THEN
      RAISE EXCEPTION 'duplicate option';
    END IF;
    SELECT count(*)
      INTO option_count
    FROM public.staff_site_alert_options o
    WHERE o.question_id = NEW.question_id
      AND o.id = ANY (NEW.option_ids);
    IF option_count <> cardinality(NEW.option_ids) THEN
      RAISE EXCEPTION 'invalid option';
    END IF;
    IF q_type = 'single' AND cardinality(NEW.option_ids) <> 1 THEN
      RAISE EXCEPTION 'single choice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_site_alert_responses_validate_trg ON public.staff_site_alert_responses;
CREATE TRIGGER staff_site_alert_responses_validate_trg
  BEFORE INSERT OR UPDATE ON public.staff_site_alert_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_site_alert_responses_validate();

REVOKE ALL ON FUNCTION public.staff_site_alert_responses_validate() FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_site_alert_questions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.staff_site_alert_options FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.staff_site_alert_responses FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.staff_site_alert_questions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_site_alert_options TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.staff_site_alert_responses TO authenticated;

ALTER TABLE public.staff_site_alert_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_site_alert_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_site_alert_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_site_alert_questions_select" ON public.staff_site_alert_questions;
CREATE POLICY "staff_site_alert_questions_select" ON public.staff_site_alert_questions
  FOR SELECT TO authenticated
  USING (
    public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1
      FROM public.staff_site_alert_recipients r
      WHERE r.alert_id = staff_site_alert_questions.alert_id
        AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_questions_insert_sender" ON public.staff_site_alert_questions;
CREATE POLICY "staff_site_alert_questions_insert_sender" ON public.staff_site_alert_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
    AND EXISTS (
      SELECT 1
      FROM public.staff_site_alerts a
      WHERE a.id = alert_id
        AND lower(a.sent_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_options_select" ON public.staff_site_alert_options;
CREATE POLICY "staff_site_alert_options_select" ON public.staff_site_alert_options
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_site_alert_questions q
      WHERE q.id = staff_site_alert_options.question_id
        AND (
          public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
          OR EXISTS (
            SELECT 1
            FROM public.staff_site_alert_recipients r
            WHERE r.alert_id = q.alert_id
              AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
        )
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_options_insert_sender" ON public.staff_site_alert_options;
CREATE POLICY "staff_site_alert_options_insert_sender" ON public.staff_site_alert_options
  FOR INSERT TO authenticated
  WITH CHECK (
    public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
    AND EXISTS (
      SELECT 1
      FROM public.staff_site_alert_questions q
      JOIN public.staff_site_alerts a ON a.id = q.alert_id
      WHERE q.id = question_id
        AND lower(a.sent_by_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_responses_select" ON public.staff_site_alert_responses;
CREATE POLICY "staff_site_alert_responses_select" ON public.staff_site_alert_responses
  FOR SELECT TO authenticated
  USING (
    public.staff_site_alert_can_send(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1
      FROM public.staff_site_alert_recipients r
      WHERE r.id = staff_site_alert_responses.recipient_id
        AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_responses_insert_own" ON public.staff_site_alert_responses;
CREATE POLICY "staff_site_alert_responses_insert_own" ON public.staff_site_alert_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff_site_alert_recipients r
      WHERE r.id = recipient_id
        AND r.alert_id = staff_site_alert_responses.alert_id
        AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND r.acknowledged_at IS NULL
    )
  );

DROP POLICY IF EXISTS "staff_site_alert_responses_delete_own_pending" ON public.staff_site_alert_responses;
CREATE POLICY "staff_site_alert_responses_delete_own_pending" ON public.staff_site_alert_responses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_site_alert_recipients r
      WHERE r.id = staff_site_alert_responses.recipient_id
        AND lower(r.recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        AND r.acknowledged_at IS NULL
    )
  );
