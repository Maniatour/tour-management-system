-- 스케줄 디스플레이 API: 다중 PostgREST 왕복을 단일 RPC로 통합

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
      'tour_guide_id', tr.tour_guide_id,
      'assistant_id', tr.assistant_id,
      'tour_car_id', tr.tour_car_id,
      'product_id', tr.product_id,
      'reservation_ids', tr.reservation_ids,
      'team_type', tr.team_type,
      'is_private_tour', tr.is_private_tour,
      'max_participants', tr.max_participants,
      'tour_start_datetime', tr.tour_start_datetime,
      'operator_id', tr.operator_id,
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
      r.choices
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
      v.rental_end_date
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
      dn.created_by
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
      'option_key', co.option_key,
      'option_name_ko', co.option_name_ko,
      'option_name', co.option_name
    ) AS choice_row
    FROM public.reservation_choices rc
    INNER JOIN public.choice_options co ON co.id = rc.option_id
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
  '스케줄 디스플레이 페이지: operator·날짜 범위 기준 핵심 테이블을 jsonb 한 번에 반환 (PostgREST 왕복 축소)';

GRANT EXECUTE ON FUNCTION public.get_schedule_display(uuid, date, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedule_display(uuid, date, date, date, date) TO service_role;
