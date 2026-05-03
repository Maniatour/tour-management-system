-- set_axes: UI에서 6축 직접 PATCH 대신 apply_ticket_booking_action 단일 RPC로 처리 (PostgREST에 별도 함수 등록 불필요)
DROP FUNCTION IF EXISTS public.apply_ticket_booking_set_axes(text, jsonb, text);

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

  ELSIF p_action = 'set_axes' THEN
    UPDATE public.ticket_bookings SET
      booking_status = CASE
        WHEN p_payload ? 'booking_status' THEN trim(p_payload->>'booking_status')
        ELSE booking_status
      END,
      vendor_status = CASE
        WHEN p_payload ? 'vendor_status' THEN trim(p_payload->>'vendor_status')
        ELSE vendor_status
      END,
      change_status = CASE
        WHEN p_payload ? 'change_status' THEN trim(p_payload->>'change_status')
        ELSE change_status
      END,
      payment_status = CASE
        WHEN p_payload ? 'payment_status' THEN trim(p_payload->>'payment_status')
        ELSE payment_status
      END,
      refund_status = CASE
        WHEN p_payload ? 'refund_status' THEN trim(p_payload->>'refund_status')
        ELSE refund_status
      END,
      operation_status = CASE
        WHEN p_payload ? 'operation_status' THEN trim(p_payload->>'operation_status')
        ELSE operation_status
      END,
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
  '단일 진입점: 액션에 따라 다축 상태·자식 테이블·레거시 status·로그 갱신. set_axes = UI 6축 직접 수정.';

GRANT EXECUTE ON FUNCTION public.apply_ticket_booking_action(text, text, jsonb, text) TO anon, authenticated, service_role;
