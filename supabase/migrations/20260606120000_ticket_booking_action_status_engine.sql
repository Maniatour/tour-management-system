-- 입장권 부킹: 다축 상태 + 액션 기반 갱신 + 로그/변경/결제/환불 자식 테이블 (1차 스키마)
-- 직원은 status 컬럼을 직접 수정하지 않고 apply_ticket_booking_action()만 사용하는 것을 전제로 합니다.
-- 기존 단일 `status` 컬럼은 리스트·정산 호환용으로 유지하며, 플래그 변경 시 파생 값으로 맞춥니다.

-- ---------------------------------------------------------------------------
-- 1) ticket_bookings 확장 컬럼
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS booking_status text NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS vendor_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS change_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_due',
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS operation_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_confirmation_number text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(12, 2);

COMMENT ON COLUMN public.ticket_bookings.booking_status IS '예약 단계: requested|on_hold|tentative|confirmed|cancel_requested|cancelled|no_show|failed|expired';
COMMENT ON COLUMN public.ticket_bookings.vendor_status IS '벤더: pending|confirmed|rejected|changed|cancelled';
COMMENT ON COLUMN public.ticket_bookings.change_status IS '변경 파이프: none|requested|confirmed|rejected|cancelled';
COMMENT ON COLUMN public.ticket_bookings.payment_status IS '결제: not_due|requested|paid|partially_paid|failed|refunded';
COMMENT ON COLUMN public.ticket_bookings.refund_status IS '환불: none|requested|credit_received|partially_refunded|refunded|rejected';
COMMENT ON COLUMN public.ticket_bookings.operation_status IS '운영: none|reconfirm_needed|reconfirmed|issue_reported|under_review|resolved';

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_booking_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_booking_status_check CHECK (
  booking_status = ANY (ARRAY[
    'requested','on_hold','tentative','confirmed','cancel_requested','cancelled','no_show','failed','expired'
  ]::text[])
);

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_vendor_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_vendor_status_check CHECK (
  vendor_status = ANY (ARRAY['pending','confirmed','rejected','changed','cancelled']::text[])
);

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_change_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_change_status_check CHECK (
  change_status = ANY (ARRAY['none','requested','confirmed','rejected','cancelled']::text[])
);

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_payment_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_payment_status_check CHECK (
  payment_status = ANY (ARRAY['not_due','requested','paid','partially_paid','failed','refunded']::text[])
);

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_refund_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_refund_status_check CHECK (
  refund_status = ANY (ARRAY['none','requested','credit_received','partially_refunded','refunded','rejected']::text[])
);

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_operation_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_operation_status_check CHECK (
  operation_status = ANY (ARRAY[
    'none','reconfirm_needed','reconfirmed','issue_reported','under_review','resolved'
  ]::text[])
);

CREATE INDEX IF NOT EXISTS idx_ticket_bookings_booking_status ON public.ticket_bookings (booking_status);
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_vendor_status ON public.ticket_bookings (vendor_status);
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_payment_status ON public.ticket_bookings (payment_status);

-- ---------------------------------------------------------------------------
-- 2) 기존 단일 status → 다축 백필 (레거시 문자열 기준)
-- ---------------------------------------------------------------------------

UPDATE public.ticket_bookings tb
SET
  booking_status = s.booking_status,
  vendor_status = s.vendor_status,
  change_status = s.change_status,
  payment_status = s.payment_status,
  refund_status = s.refund_status,
  operation_status = s.operation_status
FROM (
  SELECT
    id,
    CASE lower(trim(coalesce(status, '')))
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'canceled' THEN 'cancelled'
      WHEN 'cancellation_requested' THEN 'cancel_requested'
      WHEN 'credit' THEN 'confirmed'
      WHEN 'completed' THEN 'confirmed'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'tentative' THEN 'tentative'
      WHEN 'pending' THEN 'requested'
      WHEN 'paid' THEN 'confirmed'
      WHEN 'guest_change_requested' THEN 'confirmed'
      WHEN 'time_change_requested' THEN 'confirmed'
      WHEN 'payment_requested' THEN 'confirmed'
      ELSE 'requested'
    END AS booking_status,
    CASE lower(trim(coalesce(status, '')))
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'canceled' THEN 'cancelled'
      WHEN 'credit' THEN 'confirmed'
      WHEN 'confirmed' THEN 'confirmed'
      WHEN 'completed' THEN 'confirmed'
      WHEN 'paid' THEN 'confirmed'
      WHEN 'tentative' THEN 'pending'
      WHEN 'pending' THEN 'pending'
      WHEN 'cancellation_requested' THEN 'pending'
      WHEN 'guest_change_requested' THEN 'confirmed'
      WHEN 'time_change_requested' THEN 'confirmed'
      WHEN 'payment_requested' THEN 'confirmed'
      ELSE 'pending'
    END AS vendor_status,
    CASE lower(trim(coalesce(status, '')))
      WHEN 'guest_change_requested' THEN 'requested'
      WHEN 'time_change_requested' THEN 'requested'
      ELSE 'none'
    END AS change_status,
    CASE lower(trim(coalesce(status, '')))
      WHEN 'paid' THEN 'paid'
      WHEN 'payment_requested' THEN 'requested'
      WHEN 'completed' THEN 'paid'
      WHEN 'credit' THEN 'paid'
      ELSE 'not_due'
    END AS payment_status,
    CASE lower(trim(coalesce(status, '')))
      WHEN 'credit' THEN 'credit_received'
      ELSE 'none'
    END AS refund_status,
    'none'::text AS operation_status
  FROM public.ticket_bookings
) s
WHERE tb.id = s.id;

-- 파생 레거시 status (리스트·기존 API 호환)
CREATE OR REPLACE FUNCTION public.ticket_booking_derive_legacy_status(
  bs text,
  vs text,
  cs text,
  ps text,
  rs text,
  os text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN bs = 'cancelled' THEN 'cancelled'
    WHEN bs = 'cancel_requested' THEN 'cancellation_requested'
    WHEN bs IN ('failed', 'expired') THEN 'cancelled'
    WHEN rs IN ('credit_received', 'partially_refunded') THEN 'credit'
    WHEN rs = 'refunded' THEN 'cancelled'
    WHEN cs = 'requested' AND bs = 'confirmed' THEN 'guest_change_requested'
    WHEN ps = 'requested' AND bs = 'confirmed' THEN 'payment_requested'
    WHEN ps IN ('failed', 'partially_paid') THEN 'pending'
    WHEN bs = 'confirmed' AND ps = 'paid' THEN 'completed'
    WHEN bs = 'confirmed' THEN 'confirmed'
    WHEN bs = 'tentative' THEN 'tentative'
    WHEN bs IN ('on_hold', 'requested') THEN 'pending'
    WHEN bs = 'no_show' THEN 'completed'
    ELSE 'pending'
  END;
$$;

COMMENT ON FUNCTION public.ticket_booking_derive_legacy_status(text, text, text, text, text, text) IS
  '다축 상태 → 기존 ticket_bookings.status 단일 문자열(앱 호환).';

UPDATE public.ticket_bookings
SET status = public.ticket_booking_derive_legacy_status(
  booking_status, vendor_status, change_status, payment_status, refund_status, operation_status
);

-- ---------------------------------------------------------------------------
-- 3) 자식 테이블
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_booking_status_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_booking_id text NOT NULL REFERENCES public.ticket_bookings(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_snapshot jsonb,
  new_snapshot jsonb,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking_status_logs_booking
  ON public.ticket_booking_status_logs (ticket_booking_id, created_at DESC);

COMMENT ON TABLE public.ticket_booking_status_logs IS '액션별 상태 스냅샷 로그 (직접 status 수정 대신 기록)';

CREATE TABLE IF NOT EXISTS public.ticket_booking_changes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_booking_id text NOT NULL REFERENCES public.ticket_bookings(id) ON DELETE CASCADE,
  workflow_status text NOT NULL DEFAULT 'requested' CHECK (
    workflow_status = ANY (ARRAY['requested','confirmed','rejected','cancelled']::text[])
  ),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_note text,
  created_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking_changes_booking
  ON public.ticket_booking_changes (ticket_booking_id, created_at DESC);

COMMENT ON TABLE public.ticket_booking_changes IS '인원/시간/일자 등 변경 요청 이력 (메인 change_status와 연동)';

CREATE TABLE IF NOT EXISTS public.ticket_booking_payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_booking_id text NOT NULL REFERENCES public.ticket_bookings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (
    status = ANY (ARRAY['requested','paid','failed','cancelled']::text[])
  ),
  amount numeric(12, 2),
  due_at timestamptz,
  paid_at timestamptz,
  external_ref text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking_payments_booking
  ON public.ticket_booking_payments (ticket_booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ticket_booking_refunds (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_booking_id text NOT NULL REFERENCES public.ticket_bookings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (
    status = ANY (ARRAY['requested','credit_received','partially_refunded','refunded','rejected','cancelled']::text[])
  ),
  amount numeric(12, 2),
  credit_amount numeric(12, 2),
  resolved_at timestamptz,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking_refunds_booking
  ON public.ticket_booking_refunds (ticket_booking_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) RLS (기존 ticket_bookings와 동일하게 개방 — 추후 정책으로 조임)
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_booking_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_booking_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_booking_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for ticket_booking_status_logs" ON public.ticket_booking_status_logs;
CREATE POLICY "Enable all access for ticket_booking_status_logs"
  ON public.ticket_booking_status_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ticket_booking_changes" ON public.ticket_booking_changes;
CREATE POLICY "Enable all access for ticket_booking_changes"
  ON public.ticket_booking_changes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ticket_booking_payments" ON public.ticket_booking_payments;
CREATE POLICY "Enable all access for ticket_booking_payments"
  ON public.ticket_booking_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for ticket_booking_refunds" ON public.ticket_booking_refunds;
CREATE POLICY "Enable all access for ticket_booking_refunds"
  ON public.ticket_booking_refunds FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5) 액션 처리 (핵심 액션 구현 + 나머지는 예외로 안내)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_ticket_booking_action(
  p_booking_id text,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r_old public.ticket_bookings;
  r_new public.ticket_bookings;
  v_legacy text;
  v_change_id text;
  v_payment_id text;
  v_refund_id text;
BEGIN
  IF p_booking_id IS NULL OR length(trim(p_booking_id)) = 0 THEN
    RAISE EXCEPTION 'booking_id required';
  END IF;

  SELECT * INTO r_old FROM public.ticket_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_booking not found: %', p_booking_id;
  END IF;

  IF p_action = 'request_booking' THEN
    UPDATE public.ticket_bookings SET
      booking_status = 'requested',
      vendor_status = 'pending',
      change_status = 'none',
      payment_status = 'not_due',
      refund_status = 'none',
      operation_status = 'none',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'mark_tentative' THEN
    UPDATE public.ticket_bookings SET
      booking_status = 'tentative',
      vendor_status = 'confirmed',
      hold_expires_at = CASE
        WHEN (p_payload ? 'hold_expires_at') AND nullif(trim(p_payload->>'hold_expires_at'), '') IS NOT NULL
        THEN (p_payload->>'hold_expires_at')::timestamptz
        ELSE hold_expires_at
      END,
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'confirm_booking' THEN
    UPDATE public.ticket_bookings SET
      booking_status = 'confirmed',
      vendor_status = 'confirmed',
      change_status = 'none',
      vendor_confirmation_number = COALESCE(
        nullif(trim(p_payload->>'vendor_confirmation_number'), ''),
        vendor_confirmation_number
      ),
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'request_change' THEN
    v_change_id := gen_random_uuid()::text;
    INSERT INTO public.ticket_booking_changes (
      id, ticket_booking_id, workflow_status, request_payload, created_by
    ) VALUES (
      v_change_id, p_booking_id, 'requested', COALESCE(p_payload, '{}'::jsonb), p_actor
    );
    UPDATE public.ticket_bookings SET
      change_status = 'requested',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'confirm_change' THEN
    UPDATE public.ticket_bookings SET
      change_status = 'confirmed',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;
    IF (p_payload ? 'change_id') AND nullif(trim(p_payload->>'change_id'), '') IS NOT NULL THEN
      UPDATE public.ticket_booking_changes SET
        workflow_status = 'confirmed',
        resolved_at = now(),
        updated_at = now()
      WHERE id = trim(p_payload->>'change_id') AND ticket_booking_id = p_booking_id;
    ELSE
      UPDATE public.ticket_booking_changes c SET
        workflow_status = 'confirmed',
        resolved_at = now(),
        updated_at = now()
      FROM (
        SELECT id FROM public.ticket_booking_changes
        WHERE ticket_booking_id = p_booking_id AND workflow_status = 'requested'
        ORDER BY created_at DESC
        LIMIT 1
      ) latest
      WHERE c.id = latest.id;
    END IF;
    SELECT * INTO r_new FROM public.ticket_bookings WHERE id = p_booking_id;

  ELSIF p_action = 'request_payment' THEN
    v_payment_id := gen_random_uuid()::text;
    INSERT INTO public.ticket_booking_payments (
      id, ticket_booking_id, status, amount, due_at
    ) VALUES (
      v_payment_id,
      p_booking_id,
      'requested',
      CASE
        WHEN p_payload ? 'amount' AND (p_payload->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p_payload->>'amount')::numeric
        ELSE NULL
      END,
      CASE
        WHEN (p_payload ? 'payment_due_at') AND nullif(trim(p_payload->>'payment_due_at'), '') IS NOT NULL
        THEN (p_payload->>'payment_due_at')::timestamptz
        ELSE NULL
      END
    );
    UPDATE public.ticket_bookings SET
      payment_status = 'requested',
      payment_due_at = COALESCE(
        CASE
          WHEN (p_payload ? 'payment_due_at') AND nullif(trim(p_payload->>'payment_due_at'), '') IS NOT NULL
          THEN (p_payload->>'payment_due_at')::timestamptz
          ELSE NULL
        END,
        payment_due_at
      ),
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'mark_paid' THEN
    v_payment_id := COALESCE(
      nullif(trim(p_payload->>'payment_id'), ''),
      (
        SELECT id FROM public.ticket_booking_payments
        WHERE ticket_booking_id = p_booking_id AND status = 'requested'
        ORDER BY created_at DESC
        LIMIT 1
      )
    );
    IF v_payment_id IS NOT NULL THEN
      UPDATE public.ticket_booking_payments SET
        status = 'paid',
        paid_at = now(),
        amount = COALESCE(
          CASE
            WHEN p_payload ? 'paid_amount' AND (p_payload->>'paid_amount') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (p_payload->>'paid_amount')::numeric
            ELSE amount
          END,
          amount
        ),
        updated_at = now()
      WHERE id = v_payment_id AND ticket_booking_id = p_booking_id;
    END IF;
    UPDATE public.ticket_bookings SET
      payment_status = 'paid',
      paid_amount = COALESCE(
        CASE
          WHEN p_payload ? 'paid_amount' AND (p_payload->>'paid_amount') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (p_payload->>'paid_amount')::numeric
          ELSE NULL
        END,
        paid_amount
      ),
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'request_refund' THEN
    v_refund_id := gen_random_uuid()::text;
    INSERT INTO public.ticket_booking_refunds (
      id, ticket_booking_id, status, amount, note
    ) VALUES (
      v_refund_id,
      p_booking_id,
      'requested',
      CASE
        WHEN p_payload ? 'amount' AND (p_payload->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p_payload->>'amount')::numeric
        ELSE NULL
      END,
      nullif(trim(p_payload->>'note'), '')
    );
    UPDATE public.ticket_bookings SET
      refund_status = 'requested',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'mark_credit_received' THEN
    v_refund_id := COALESCE(
      nullif(trim(p_payload->>'refund_id'), ''),
      (
        SELECT id FROM public.ticket_booking_refunds
        WHERE ticket_booking_id = p_booking_id AND status = 'requested'
        ORDER BY created_at DESC
        LIMIT 1
      )
    );
    IF v_refund_id IS NOT NULL THEN
      UPDATE public.ticket_booking_refunds SET
        status = 'credit_received',
        credit_amount = COALESCE(
          CASE
            WHEN p_payload ? 'credit_amount' AND (p_payload->>'credit_amount') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (p_payload->>'credit_amount')::numeric
            ELSE NULL
          END,
          credit_amount
        ),
        resolved_at = now(),
        updated_at = now()
      WHERE id = v_refund_id AND ticket_booking_id = p_booking_id;
    END IF;
    UPDATE public.ticket_bookings SET
      refund_status = 'credit_received',
      credit_amount = COALESCE(
        CASE
          WHEN p_payload ? 'credit_amount' AND (p_payload->>'credit_amount') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (p_payload->>'credit_amount')::numeric
          ELSE NULL
        END,
        credit_amount
      ),
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'mark_refunded' THEN
    v_refund_id := COALESCE(
      nullif(trim(p_payload->>'refund_id'), ''),
      (
        SELECT id FROM public.ticket_booking_refunds
        WHERE ticket_booking_id = p_booking_id
        ORDER BY created_at DESC
        LIMIT 1
      )
    );
    IF v_refund_id IS NOT NULL THEN
      UPDATE public.ticket_booking_refunds SET
        status = 'refunded',
        amount = COALESCE(
          CASE
            WHEN p_payload ? 'refund_amount' AND (p_payload->>'refund_amount') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (p_payload->>'refund_amount')::numeric
            ELSE amount
          END,
          amount
        ),
        resolved_at = now(),
        updated_at = now()
      WHERE id = v_refund_id AND ticket_booking_id = p_booking_id;
    END IF;
    UPDATE public.ticket_bookings SET
      refund_status = 'refunded',
      refund_amount = COALESCE(
        CASE
          WHEN p_payload ? 'refund_amount' AND (p_payload->>'refund_amount') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (p_payload->>'refund_amount')::numeric
          ELSE NULL
        END,
        refund_amount
      ),
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'report_issue' THEN
    UPDATE public.ticket_bookings SET
      operation_status = 'issue_reported',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSE
    RAISE EXCEPTION 'unsupported action: % (지원 액션만 구현됨)', p_action;
  END IF;

  v_legacy := public.ticket_booking_derive_legacy_status(
    r_new.booking_status,
    r_new.vendor_status,
    r_new.change_status,
    r_new.payment_status,
    r_new.refund_status,
    r_new.operation_status
  );

  UPDATE public.ticket_bookings
  SET status = v_legacy, updated_at = now()
  WHERE id = p_booking_id;

  SELECT * INTO r_new FROM public.ticket_bookings WHERE id = p_booking_id;

  INSERT INTO public.ticket_booking_status_logs (
    ticket_booking_id, action, payload, old_snapshot, new_snapshot, actor
  ) VALUES (
    p_booking_id,
    p_action,
    COALESCE(p_payload, '{}'::jsonb),
    to_jsonb(r_old),
    to_jsonb(r_new),
    p_actor
  );

  RETURN jsonb_build_object(
    'ok', true,
    'booking', to_jsonb(r_new),
    'legacy_status', to_jsonb(v_legacy)
  );
END;
$$;

COMMENT ON FUNCTION public.apply_ticket_booking_action(text, text, jsonb, text) IS
  '단일 진입점: 액션에 따라 다축 상태·자식 테이블·레거시 status·로그 갱신.';

GRANT EXECUTE ON FUNCTION public.apply_ticket_booking_action(text, text, jsonb, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_booking_derive_legacy_status(text, text, text, text, text, text) TO anon, authenticated, service_role;
