-- 가이드/어시스턴트 배정 고정: 고객 지정 가이드가 스케줄뷰에서 다른 팀으로 옮겨지거나 해제되지 않도록 잠금

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS guide_assignment_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS assistant_assignment_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tours.guide_assignment_locked IS
  'When true, tour_guide_id cannot be changed until unlocked in tour details.';

COMMENT ON COLUMN public.tours.assistant_assignment_locked IS
  'When true, assistant_id cannot be changed until unlocked in tour details.';

CREATE OR REPLACE FUNCTION public.tour_status_is_inactive_for_assignment_lock(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(lower(trim(p_status)), '') ~ '(cancel|deleted|삭제|취소|requested for delete)';
$$;

CREATE OR REPLACE FUNCTION public.prevent_locked_staff_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_locked_elsewhere boolean := false;
BEGIN
  IF OLD.guide_assignment_locked IS TRUE
     AND NEW.tour_guide_id IS DISTINCT FROM OLD.tour_guide_id THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_LOCKED:guide'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.assistant_assignment_locked IS TRUE
     AND NEW.assistant_id IS DISTINCT FROM OLD.assistant_id THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_LOCKED:assistant'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.tour_guide_id IS DISTINCT FROM OLD.tour_guide_id
     AND NEW.tour_guide_id IS NOT NULL
     AND btrim(NEW.tour_guide_id) <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tours t
      WHERE t.id <> NEW.id
        AND t.tour_date = NEW.tour_date
        AND NOT public.tour_status_is_inactive_for_assignment_lock(t.tour_status)
        AND (
          (t.guide_assignment_locked IS TRUE AND lower(btrim(coalesce(t.tour_guide_id, ''))) = lower(btrim(NEW.tour_guide_id)))
          OR (t.assistant_assignment_locked IS TRUE AND lower(btrim(coalesce(t.assistant_id, ''))) = lower(btrim(NEW.tour_guide_id)))
        )
    )
    INTO v_locked_elsewhere;

    IF v_locked_elsewhere THEN
      RAISE EXCEPTION 'STAFF_ASSIGNMENT_LOCKED:staff_elsewhere'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.assistant_id IS DISTINCT FROM OLD.assistant_id
     AND NEW.assistant_id IS NOT NULL
     AND btrim(NEW.assistant_id) <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tours t
      WHERE t.id <> NEW.id
        AND t.tour_date = NEW.tour_date
        AND NOT public.tour_status_is_inactive_for_assignment_lock(t.tour_status)
        AND (
          (t.guide_assignment_locked IS TRUE AND lower(btrim(coalesce(t.tour_guide_id, ''))) = lower(btrim(NEW.assistant_id)))
          OR (t.assistant_assignment_locked IS TRUE AND lower(btrim(coalesce(t.assistant_id, ''))) = lower(btrim(NEW.assistant_id)))
        )
    )
    INTO v_locked_elsewhere;

    IF v_locked_elsewhere THEN
      RAISE EXCEPTION 'STAFF_ASSIGNMENT_LOCKED:staff_elsewhere'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tours_prevent_locked_staff_assignment_change ON public.tours;

CREATE TRIGGER tours_prevent_locked_staff_assignment_change
  BEFORE UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_staff_assignment_change();

CREATE OR REPLACE FUNCTION public.get_schedule_display(
  p_operator_id uuid,
  p_range_start date,
  p_range_end date,
  p_grid_note_start date,
  p_grid_note_end date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_products jsonb;
  v_team jsonb;
  v_tours jsonb;
  v_reservations jsonb;
  v_vehicles jsonb;
  v_ticket_bookings jsonb;
  v_tour_hotel_bookings jsonb;
  v_off_schedules jsonb;
  v_date_notes jsonb;
  v_reservation_choices jsonb;
  v_customers jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.name), '[]'::jsonb)
  INTO v_products
  FROM public.products p
  WHERE p.operator_id = p_operator_id
    AND p.sub_category IN ('Mania Tour', 'Mania Service');

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.name_ko), '[]'::jsonb)
  INTO v_team
  FROM public.team t
  WHERE t.is_active = true;

  SELECT coalesce(
    jsonb_agg(tour_row ORDER BY tour_row->>'tour_date', tour_row->>'id'),
    '[]'::jsonb
  )
  INTO v_tours
  FROM (
    SELECT jsonb_build_object(
      'id', tr.id,
      'tour_date', tr.tour_date,
      'tour_status', tr.tour_status,
      'assignment_status', tr.assignment_status,
      'tour_guide_id', tr.tour_guide_id,
      'assistant_id', tr.assistant_id,
      'guide_assignment_locked', tr.guide_assignment_locked,
      'assistant_assignment_locked', tr.assistant_assignment_locked,
      'tour_car_id', tr.tour_car_id,
      'product_id', tr.product_id,
      'reservation_ids', tr.reservation_ids,
      'team_type', tr.team_type,
      'is_private_tour', tr.is_private_tour,
      'max_participants', tr.max_participants,
      'tour_start_datetime', tr.tour_start_datetime,
      'operator_id', tr.operator_id,
      'antelope_check_in_date', tr.antelope_check_in_date,
      'products', CASE
        WHEN pr.id IS NOT NULL THEN jsonb_build_object('name', pr.name)
        ELSE NULL
      END
    ) AS tour_row
    FROM public.tours tr
    LEFT JOIN public.products pr ON pr.id = tr.product_id
    WHERE tr.operator_id = p_operator_id
      AND tr.tour_date >= p_range_start
      AND tr.tour_date <= p_range_end
  ) tours_sub;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.tour_date, r.id), '[]'::jsonb)
  INTO v_reservations
  FROM (
    SELECT
      r.id,
      r.tour_date,
      r.product_id,
      r.total_people,
      r.status,
      r.customer_id,
      r.choices,
      r.canyon_choice,
      r.is_private_tour,
      r.created_at,
      r.pickup_hotel,
      r.tour_id
    FROM public.reservations r
    WHERE r.operator_id = p_operator_id
      AND r.tour_date >= p_range_start
      AND r.tour_date <= p_range_end
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.vehicle_number), '[]'::jsonb)
  INTO v_vehicles
  FROM (
    SELECT
      v.id,
      v.vehicle_number,
      v.nick,
      v.vehicle_category,
      v.status,
      v.rental_start_date,
      v.rental_end_date,
      v.engine_oil_change_cycle,
      v.recent_engine_oil_change_mileage,
      v.current_mileage
    FROM public.vehicles v
    WHERE v.operator_id = p_operator_id
  ) v;

  SELECT coalesce(jsonb_agg(to_jsonb(tb) ORDER BY tb.check_in_date, tb.id), '[]'::jsonb)
  INTO v_ticket_bookings
  FROM (
    SELECT
      tb.id,
      tb.tour_id,
      tb.status,
      tb.ea,
      tb.company,
      tb.category,
      tb.time,
      tb.check_in_date,
      tb.booking_status,
      tb.vendor_status,
      tb.change_status,
      tb.payment_status,
      tb.refund_status,
      tb.operation_status,
      tb.deletion_requested_at
    FROM public.ticket_bookings tb
    WHERE tb.check_in_date >= p_range_start
      AND tb.check_in_date <= p_range_end
  ) tb;

  SELECT coalesce(jsonb_agg(to_jsonb(thb) ORDER BY thb.check_in_date, thb.id), '[]'::jsonb)
  INTO v_tour_hotel_bookings
  FROM (
    SELECT
      thb.id,
      thb.tour_id,
      thb.status,
      thb.rooms,
      thb.hotel,
      thb.check_in_date
    FROM public.tour_hotel_bookings thb
    WHERE thb.check_in_date >= p_range_start
      AND thb.check_in_date <= p_range_end
  ) thb;

  SELECT coalesce(jsonb_agg(to_jsonb(os) ORDER BY os.off_date, os.team_email), '[]'::jsonb)
  INTO v_off_schedules
  FROM (
    SELECT
      os.team_email,
      os.off_date,
      os.reason,
      os.status
    FROM public.off_schedules os
    WHERE os.status IN ('pending', 'approved')
      AND os.off_date >= p_grid_note_start
      AND os.off_date <= p_grid_note_end
  ) os;

  SELECT coalesce(jsonb_agg(to_jsonb(dn) ORDER BY dn.note_date), '[]'::jsonb)
  INTO v_date_notes
  FROM (
    SELECT
      dn.note_date,
      dn.note,
      dn.created_by,
      dn.highlight_guide_schedule
    FROM public.date_notes dn
    WHERE dn.note_date >= p_grid_note_start
      AND dn.note_date <= p_grid_note_end
  ) dn;

  SELECT coalesce(jsonb_agg(choice_row ORDER BY choice_row->>'reservation_id'), '[]'::jsonb)
  INTO v_reservation_choices
  FROM (
    SELECT jsonb_build_object(
      'reservation_id', rc.reservation_id,
      'quantity', rc.quantity,
      'option_key', COALESCE(rc.option_key, co.option_key),
      'canonical_option_key', rc.canonical_option_key,
      'canyon_key', rc.canyon_key,
      'option_name_ko', co.option_name_ko,
      'option_name', co.option_name
    ) AS choice_row
    FROM public.reservation_choices rc
    LEFT JOIN public.choice_options co ON co.id = rc.option_id
    INNER JOIN public.reservations r ON r.id = rc.reservation_id
    WHERE r.operator_id = p_operator_id
      AND r.tour_date >= p_range_start
      AND r.tour_date <= p_range_end
  ) choices_sub;

  SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
  INTO v_customers
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.language,
      c.name
    FROM public.customers c
    INNER JOIN public.reservations r ON r.customer_id = c.id
    WHERE r.operator_id = p_operator_id
      AND r.tour_date >= p_range_start
      AND r.tour_date <= p_range_end
    ORDER BY c.id
  ) c;

  RETURN jsonb_build_object(
    'products', v_products,
    'teamMembers', v_team,
    'tours', v_tours,
    'reservations', v_reservations,
    'vehicles', v_vehicles,
    'ticketBookings', v_ticket_bookings,
    'tourHotelBookings', v_tour_hotel_bookings,
    'offSchedules', v_off_schedules,
    'dateNotes', v_date_notes,
    'reservationChoices', v_reservation_choices,
    'customers', v_customers
  );
END;
$$;

COMMENT ON FUNCTION public.get_schedule_display(uuid, date, date, date, date) IS
  'Schedule view payload; tours include guide/assistant assignment lock flags.';
