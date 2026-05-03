-- workflow_vendor_confirm_initial: 모달에서 입력한 RN#을 p_payload.rn_number 로 반영하고,
-- RN 유무에 따라 예약 축을 tentative / confirmed 로 나눕니다.
-- (앞선 마이그레이션과 동일한 apply_ticket_booking_action 본문을 유지합니다.)

CREATE OR REPLACE FUNCTION record_booking_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO booking_history (booking_type, booking_id, action, new_values, changed_by)
        VALUES (
            CASE
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            NEW.id,
            'created',
            to_jsonb(NEW),
            COALESCE(NEW.submitted_by, 'system')
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF current_setting('app.skip_ticket_booking_history', true) = 'on' THEN
            RETURN NEW;
        END IF;
        INSERT INTO booking_history (booking_type, booking_id, action, old_values, new_values, changed_by)
        VALUES (
            CASE
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            NEW.id,
            'updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            COALESCE(NEW.submitted_by, 'system')
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO booking_history (booking_type, booking_id, action, old_values, changed_by)
        VALUES (
            CASE
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            OLD.id,
            'deleted',
            to_jsonb(OLD),
            'system'
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
    WHEN cs = 'requested' AND bs IN ('confirmed', 'tentative', 'on_hold') THEN 'guest_change_requested'
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
  v_set_bs text;
  v_set_vs text;
  v_rn text;
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
    v_set_bs := CASE
      WHEN p_payload ? 'booking_status' THEN trim(p_payload->>'booking_status')
      ELSE r_old.booking_status
    END;
    v_set_vs := CASE
      WHEN p_payload ? 'vendor_status' THEN trim(p_payload->>'vendor_status')
      ELSE r_old.vendor_status
    END;

    IF v_set_vs = 'confirmed'
       AND r_old.vendor_status = 'pending'
       AND r_old.change_status = 'none'
       AND lower(trim(coalesce(v_set_bs, ''))) = lower(trim(coalesce(r_old.booking_status, '')))
    THEN
      IF lower(trim(coalesce(r_old.booking_status, ''))) = 'tentative' THEN
        v_set_bs := 'confirmed';
      ELSIF lower(trim(coalesce(r_old.booking_status, ''))) = 'requested' THEN
        v_set_bs := CASE
          WHEN nullif(trim(coalesce(r_old.rn_number, '')), '') IS NOT NULL THEN 'confirmed'
          ELSE 'tentative'
        END;
      END IF;
    END IF;

    UPDATE public.ticket_bookings SET
      booking_status = v_set_bs,
      vendor_status = v_set_vs,
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

  ELSIF p_action = 'workflow_vendor_confirm_initial' THEN
    IF NOT (
      r_old.booking_status = 'requested'
      AND r_old.vendor_status = 'pending'
      AND r_old.change_status = 'none'
    ) THEN
      RAISE EXCEPTION 'workflow_vendor_confirm_initial: invalid state';
    END IF;
    v_rn := COALESCE(
      nullif(trim(p_payload->>'rn_number'), ''),
      r_old.rn_number
    );
    UPDATE public.ticket_bookings SET
      rn_number = v_rn,
      booking_status = CASE
        WHEN nullif(trim(coalesce(v_rn, '')), '') IS NOT NULL THEN 'confirmed'::text
        ELSE 'tentative'::text
      END,
      vendor_status = 'confirmed',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'workflow_vendor_reject_initial' THEN
    IF NOT (
      r_old.booking_status = 'requested'
      AND r_old.vendor_status = 'pending'
      AND r_old.change_status = 'none'
    ) THEN
      RAISE EXCEPTION 'workflow_vendor_reject_initial: invalid state';
    END IF;
    UPDATE public.ticket_bookings SET
      booking_status = 'failed',
      vendor_status = 'rejected',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'workflow_submit_change' THEN
    IF NOT (
      r_old.vendor_status = 'confirmed'
      AND r_old.change_status = 'none'
      AND r_old.booking_status IN ('confirmed', 'tentative', 'on_hold')
    ) THEN
      RAISE EXCEPTION 'workflow_submit_change: invalid state';
    END IF;
    IF NOT (p_payload ? 'pending_ea') OR (p_payload->>'pending_ea') !~ '^-?[0-9]+$' THEN
      RAISE EXCEPTION 'workflow_submit_change: pending_ea required (integer)';
    END IF;
    UPDATE public.ticket_bookings SET
      booking_status_before_change = r_old.booking_status,
      pending_ea = (p_payload->>'pending_ea')::integer,
      pending_time = CASE
        WHEN (p_payload ? 'pending_time') AND nullif(trim(p_payload->>'pending_time'), '') IS NOT NULL
        THEN trim(p_payload->>'pending_time')
        ELSE trim(r_old.time::text)
      END,
      change_status = 'requested',
      vendor_status = 'pending',
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'workflow_vendor_confirm_change' THEN
    IF NOT (r_old.change_status = 'requested' AND r_old.vendor_status = 'pending') THEN
      RAISE EXCEPTION 'workflow_vendor_confirm_change: invalid state';
    END IF;
    IF r_old.pending_ea IS NULL THEN
      RAISE EXCEPTION 'workflow_vendor_confirm_change: no pending change';
    END IF;
    IF r_old.pending_ea = 0 THEN
      UPDATE public.ticket_bookings SET
        booking_status = 'cancelled',
        vendor_status = 'confirmed',
        change_status = 'none',
        pending_ea = NULL,
        pending_time = NULL,
        booking_status_before_change = NULL,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO r_new;
    ELSE
      UPDATE public.ticket_bookings SET
        ea = r_old.pending_ea,
        time = CASE
          WHEN nullif(trim(coalesce(r_old.pending_time, '')), '') IS NOT NULL
          THEN r_old.pending_time::time
          ELSE r_old.time
        END,
        booking_status = COALESCE(r_old.booking_status_before_change, 'confirmed'::text),
        vendor_status = 'confirmed',
        change_status = 'none',
        pending_ea = NULL,
        pending_time = NULL,
        booking_status_before_change = NULL,
        updated_at = now()
      WHERE id = p_booking_id
      RETURNING * INTO r_new;
    END IF;

  ELSIF p_action = 'workflow_vendor_reject_change' THEN
    IF NOT (r_old.change_status = 'requested' AND r_old.vendor_status = 'pending') THEN
      RAISE EXCEPTION 'workflow_vendor_reject_change: invalid state';
    END IF;
    UPDATE public.ticket_bookings SET
      booking_status = COALESCE(r_old.booking_status_before_change, r_old.booking_status),
      vendor_status = 'confirmed',
      change_status = 'none',
      pending_ea = NULL,
      pending_time = NULL,
      booking_status_before_change = NULL,
      updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO r_new;

  ELSIF p_action = 'workflow_complete_payment' THEN
    UPDATE public.ticket_bookings SET
      payment_status = 'paid',
      paid_amount = CASE
        WHEN p_payload ? 'paid_amount' AND (p_payload->>'paid_amount') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p_payload->>'paid_amount')::numeric
        ELSE COALESCE(paid_amount, expense)
      END,
      ea = CASE
        WHEN p_payload ? 'ea' AND (p_payload->>'ea') ~ '^[0-9]+$'
        THEN (p_payload->>'ea')::integer
        ELSE ea
      END,
      expense = CASE
        WHEN p_payload ? 'expense' AND (p_payload->>'expense') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (p_payload->>'expense')::numeric
        ELSE expense
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

  PERFORM set_config('app.skip_ticket_booking_history', 'on', true);
  UPDATE public.ticket_bookings
  SET status = v_legacy, updated_at = now()
  WHERE id = p_booking_id;
  PERFORM set_config('app.skip_ticket_booking_history', '', true);

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
  '단일 진입점: 액션·set_axes·워크플로우(벤더 응답·변경·결제 완료). set_axes 벤더 확정 승격·홀드에서 수량·시간 변경 요청 포함.';

GRANT EXECUTE ON FUNCTION public.apply_ticket_booking_action(text, text, jsonb, text) TO anon, authenticated, service_role;
