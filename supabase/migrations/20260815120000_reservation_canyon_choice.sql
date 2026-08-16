-- Canonical canyon choice for calendar + future OTA availability/rates.
-- Identity: reservation_choices.canyon_key + canonical_option_key.
-- Do not recalculate reservation_pricing amounts.

-- ---------------------------------------------------------------------------
-- Catalog: canyon + canonical keys (option_key UUID 유지 — choices_pricing 호환)
-- ---------------------------------------------------------------------------
ALTER TABLE public.choice_options
  ADD COLUMN IF NOT EXISTS canyon_key text,
  ADD COLUMN IF NOT EXISTS canonical_option_key text;

ALTER TABLE public.choice_options
  DROP CONSTRAINT IF EXISTS choice_options_canyon_key_check;
ALTER TABLE public.choice_options
  ADD CONSTRAINT choice_options_canyon_key_check
  CHECK (canyon_key IS NULL OR canyon_key IN ('X', 'L', 'U'));

-- ---------------------------------------------------------------------------
-- Reservation line + summary
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservation_choices
  ADD COLUMN IF NOT EXISTS canyon_key text,
  ADD COLUMN IF NOT EXISTS canonical_option_key text;

ALTER TABLE public.reservation_choices
  DROP CONSTRAINT IF EXISTS reservation_choices_canyon_key_check;
ALTER TABLE public.reservation_choices
  ADD CONSTRAINT reservation_choices_canyon_key_check
  CHECK (canyon_key IS NULL OR canyon_key IN ('X', 'L', 'U'));

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS canyon_choice text;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_canyon_choice_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_canyon_choice_check
  CHECK (canyon_choice IS NULL OR canyon_choice IN ('X', 'L', 'U'));

CREATE INDEX IF NOT EXISTS idx_choice_options_canyon_key
  ON public.choice_options (canyon_key)
  WHERE canyon_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_choice_options_canonical_option_key
  ON public.choice_options (canonical_option_key)
  WHERE canonical_option_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_choices_canyon_key
  ON public.reservation_choices (canyon_key)
  WHERE canyon_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_canyon_choice
  ON public.reservations (canyon_choice)
  WHERE canyon_choice IS NOT NULL;

COMMENT ON COLUMN public.choice_options.canyon_key IS
  'Antelope inventory axis X/L/U. Derived from names; survives option UUID regen.';
COMMENT ON COLUMN public.choice_options.canonical_option_key IS
  'Stable OTA mapping key (antelope_x, lower_antelope). Does not replace option_key.';
COMMENT ON COLUMN public.reservation_choices.canyon_key IS
  'Stored canyon pick for this reservation line. Calendar/OTA remaining source.';
COMMENT ON COLUMN public.reservation_choices.canonical_option_key IS
  'Copied/derived OTA option key at booking time.';
COMMENT ON COLUMN public.reservations.canyon_choice IS
  'Denormalized party canyon X/L/U from reservation_choices. Calendar chip left count.';

-- ---------------------------------------------------------------------------
-- derive_canyon_key: same rules as src/lib/tourChoiceCounts.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_canyon_key(
  p_option_key text,
  p_name_ko text,
  p_name_en text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  raw_key text := btrim(coalesce(p_option_key, ''));
  k text;
  label text;
  label_lower text;
  label_compact text;
  is_uuid boolean;
BEGIN
  is_uuid := raw_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF raw_key <> '' AND NOT is_uuid THEN
    k := lower(regexp_replace(raw_key, '[\s-]+', '_', 'g'));
    IF k IN ('antelope_x', 'antelopex', 'x', 'antelope_x_canyon') THEN
      RETURN 'X';
    END IF;
    IF k IN ('lower_antelope', 'lowerantelope', 'l', 'lower_antelope_canyon') THEN
      RETURN 'L';
    END IF;
    IF k IN ('upper_antelope', 'upperantelope', 'u', 'upper_antelope_canyon') THEN
      RETURN 'U';
    END IF;
  END IF;

  label := btrim(coalesce(
    NULLIF(p_name_ko, ''),
    NULLIF(p_name_en, ''),
    CASE WHEN raw_key <> '' AND NOT is_uuid THEN raw_key ELSE '' END
  ));
  label_lower := lower(label);
  label_compact := regexp_replace(label_lower, '\s+', '', 'g');

  IF label_lower LIKE '%antelope x canyon%'
     OR label_lower ~ 'antelope[[:space:]]*canyon[[:space:]]*x'
     OR label_compact LIKE '%antelopex%'
     OR label ~ '엑스[[:space:]]*앤텔롭|엑스[[:space:]]*앤틸롭|엑스[[:space:]]*엔텔롭'
     OR label ~* '앤텔롭[[:space:]]*x|앤텔로프[[:space:]]*x|앤틸롭[[:space:]]*x'
  THEN
    RETURN 'X';
  END IF;
  IF label_lower LIKE '%lower antelope canyon%'
     OR label ~ '로어[[:space:]]*앤텔롭|로어[[:space:]]*앤틸롭|로어[[:space:]]*엔텔롭'
  THEN
    RETURN 'L';
  END IF;
  IF label_lower LIKE '%upper antelope canyon%'
     OR label ~ '어퍼[[:space:]]*앤텔롭|어퍼[[:space:]]*앤틸롭|어퍼[[:space:]]*엔텔롭'
  THEN
    RETURN 'U';
  END IF;
  IF label_lower LIKE '%antelope x%'
     OR label_lower LIKE '% x %'
     OR label_lower ~ 'x[[:space:]]*canyon'
  THEN
    RETURN 'X';
  END IF;
  IF label_lower LIKE '%lower antelope%' OR label_lower LIKE '%lower_antelope%' THEN
    RETURN 'L';
  END IF;
  IF label_lower LIKE '%upper antelope%' OR label_lower LIKE '%upper_antelope%' THEN
    RETURN 'U';
  END IF;
  IF label_lower LIKE '%lower%' THEN
    RETURN 'L';
  END IF;
  IF label_lower LIKE '%upper%' THEN
    RETURN 'U';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_option_key_from_canyon(p_canyon_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_canyon_key
    WHEN 'X' THEN 'antelope_x'
    WHEN 'L' THEN 'lower_antelope'
    WHEN 'U' THEN 'upper_antelope'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Catalog fill
-- ---------------------------------------------------------------------------
UPDATE public.choice_options co
SET canyon_key = public.derive_canyon_key(co.option_key, co.option_name_ko, co.option_name)
WHERE co.canyon_key IS NULL
  AND public.derive_canyon_key(co.option_key, co.option_name_ko, co.option_name) IS NOT NULL;

UPDATE public.choice_options co
SET canonical_option_key = public.canonical_option_key_from_canyon(co.canyon_key)
WHERE co.canonical_option_key IS NULL
  AND co.canyon_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_fill_choice_option_canyon_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.canyon_key IS NULL THEN
    NEW.canyon_key := public.derive_canyon_key(NEW.option_key, NEW.option_name_ko, NEW.option_name);
  END IF;
  IF NEW.canonical_option_key IS NULL AND NEW.canyon_key IS NOT NULL THEN
    NEW.canonical_option_key := public.canonical_option_key_from_canyon(NEW.canyon_key);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fill_choice_option_canyon_keys ON public.choice_options;
CREATE TRIGGER trigger_fill_choice_option_canyon_keys
  BEFORE INSERT OR UPDATE OF option_key, option_name, option_name_ko, canyon_key, canonical_option_key
  ON public.choice_options
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fill_choice_option_canyon_keys();

-- ---------------------------------------------------------------------------
-- Reservation line fill (never overwrite a stored canyon_key)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fill_reservation_choice_canyon_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cat_key text;
  cat_canyon text;
  cat_canonical text;
  cat_name_ko text;
  cat_name_en text;
BEGIN
  IF NEW.option_id IS NOT NULL THEN
    SELECT co.option_key, co.canyon_key, co.canonical_option_key, co.option_name_ko, co.option_name
      INTO cat_key, cat_canyon, cat_canonical, cat_name_ko, cat_name_en
    FROM public.choice_options co
    WHERE co.id = NEW.option_id;
  END IF;

  IF NEW.option_key IS NULL OR btrim(NEW.option_key) = '' THEN
    NEW.option_key := cat_key;
  END IF;

  IF NEW.canyon_key IS NULL THEN
    NEW.canyon_key := COALESCE(
      cat_canyon,
      public.derive_canyon_key(NEW.option_key, cat_name_ko, cat_name_en)
    );
  END IF;

  IF NEW.canonical_option_key IS NULL OR btrim(NEW.canonical_option_key) = '' THEN
    NEW.canonical_option_key := COALESCE(
      cat_canonical,
      public.canonical_option_key_from_canyon(NEW.canyon_key)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fill_reservation_choice_canyon_keys ON public.reservation_choices;
CREATE TRIGGER trigger_fill_reservation_choice_canyon_keys
  BEFORE INSERT OR UPDATE
  ON public.reservation_choices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fill_reservation_choice_canyon_keys();

CREATE OR REPLACE FUNCTION public.sync_reservation_canyon_choice(p_reservation_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  picked text;
BEGIN
  IF p_reservation_id IS NULL OR btrim(p_reservation_id) = '' THEN
    RETURN;
  END IF;
  SELECT rc.canyon_key
    INTO picked
  FROM public.reservation_choices rc
  WHERE rc.reservation_id = p_reservation_id
    AND rc.canyon_key IN ('X', 'L', 'U')
  ORDER BY COALESCE(rc.quantity, 1) DESC, rc.created_at ASC NULLS LAST
  LIMIT 1;

  UPDATE public.reservations
  SET canyon_choice = picked
  WHERE id = p_reservation_id
    AND canyon_choice IS DISTINCT FROM picked;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_reservation_canyon_choice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_reservation_canyon_choice(COALESCE(NEW.reservation_id, OLD.reservation_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_reservation_canyon_choice ON public.reservation_choices;
CREATE TRIGGER trigger_sync_reservation_canyon_choice
  AFTER INSERT OR UPDATE OF canyon_key, quantity, reservation_id OR DELETE
  ON public.reservation_choices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_reservation_canyon_choice();

-- ---------------------------------------------------------------------------
-- Backfill existing reservation_choices from catalog names / keys
-- ---------------------------------------------------------------------------
UPDATE public.reservation_choices rc
SET canyon_key = COALESCE(
  co.canyon_key,
  public.derive_canyon_key(
    COALESCE(rc.option_key, co.option_key),
    co.option_name_ko,
    co.option_name
  )
)
FROM public.choice_options co
WHERE rc.option_id = co.id
  AND rc.canyon_key IS NULL
  AND COALESCE(
    co.canyon_key,
    public.derive_canyon_key(
      COALESCE(rc.option_key, co.option_key),
      co.option_name_ko,
      co.option_name
    )
  ) IS NOT NULL;

UPDATE public.reservation_choices rc
SET canyon_key = public.derive_canyon_key(rc.option_key, NULL, NULL)
WHERE rc.canyon_key IS NULL
  AND public.derive_canyon_key(rc.option_key, NULL, NULL) IS NOT NULL;

UPDATE public.reservation_choices rc
SET canonical_option_key = COALESCE(
  co.canonical_option_key,
  public.canonical_option_key_from_canyon(rc.canyon_key)
)
FROM public.choice_options co
WHERE rc.option_id = co.id
  AND rc.canonical_option_key IS NULL
  AND rc.canyon_key IS NOT NULL;

UPDATE public.reservation_choices
SET canonical_option_key = public.canonical_option_key_from_canyon(canyon_key)
WHERE canonical_option_key IS NULL
  AND canyon_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Insert missing reservation_choices from JSON (identity only, no price rewrite)
-- ---------------------------------------------------------------------------
INSERT INTO public.reservation_choices (
  reservation_id,
  choice_id,
  option_id,
  option_key,
  quantity,
  total_price
)
SELECT
  src.reservation_id,
  src.choice_id,
  src.option_id,
  src.option_key,
  src.quantity,
  src.total_price
FROM (
  SELECT
    r.id AS reservation_id,
    CASE
      WHEN (item->>'choice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND EXISTS (
             SELECT 1 FROM public.product_choices pc
             WHERE pc.id = (item->>'choice_id')::uuid
           )
      THEN (item->>'choice_id')::uuid
      ELSE NULL
    END AS choice_id,
    COALESCE(
      CASE
        WHEN (item->>'option_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             AND EXISTS (
               SELECT 1 FROM public.choice_options co
               WHERE co.id = (item->>'option_id')::uuid
             )
        THEN (item->>'option_id')::uuid
        ELSE NULL
      END,
      (
        SELECT a.current_option_id
        FROM public.choice_option_aliases a
        WHERE (item->>'option_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND a.old_option_id = (item->>'option_id')::uuid
        LIMIT 1
      ),
      (
        SELECT co.id
        FROM public.choice_options co
        JOIN public.product_choices pc ON pc.id = co.choice_id
        WHERE r.product_id IS NOT NULL
          AND pc.product_id = r.product_id
          AND co.option_key = item->>'option_id'
        LIMIT 1
      )
    ) AS option_id,
    NULLIF(btrim(COALESCE(item->>'option_key', item->>'option_id')), '') AS option_key,
    GREATEST(COALESCE(NULLIF(item->>'quantity', '')::int, 1), 1) AS quantity,
    COALESCE(NULLIF(item->>'total_price', '')::numeric, 0) AS total_price
  FROM public.reservations r
  LEFT JOIN public.reservation_pricing rp ON rp.reservation_id = r.id
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(
      CASE
        WHEN jsonb_typeof(r.choices->'required') = 'array' THEN r.choices->'required'
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(rp.choices->'required') = 'array' THEN rp.choices->'required'
        ELSE NULL
      END,
      '[]'::jsonb
    )
  ) AS item
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reservation_choices rc WHERE rc.reservation_id = r.id
  )
    AND COALESCE(item->>'option_id', '') NOT IN ('', '__undecided__', 'undecided')
) src
WHERE src.option_id IS NOT NULL
   OR src.choice_id IS NOT NULL
   OR src.option_key IS NOT NULL;

-- Re-fill keys for newly inserted rows (trigger already ran; keep idempotent)
UPDATE public.reservation_choices rc
SET canyon_key = COALESCE(
  rc.canyon_key,
  co.canyon_key,
  public.derive_canyon_key(
    COALESCE(rc.option_key, co.option_key),
    co.option_name_ko,
    co.option_name
  )
)
FROM public.choice_options co
WHERE rc.option_id = co.id
  AND rc.canyon_key IS NULL;

-- ---------------------------------------------------------------------------
-- Sync reservation summaries
-- ---------------------------------------------------------------------------
UPDATE public.reservations r
SET canyon_choice = picked.canyon_key
FROM (
  SELECT DISTINCT ON (rc.reservation_id)
    rc.reservation_id,
    rc.canyon_key
  FROM public.reservation_choices rc
  WHERE rc.canyon_key IN ('X', 'L', 'U')
  ORDER BY rc.reservation_id, COALESCE(rc.quantity, 1) DESC, rc.created_at ASC NULLS LAST
) picked
WHERE r.id = picked.reservation_id
  AND r.canyon_choice IS DISTINCT FROM picked.canyon_key;

-- ---------------------------------------------------------------------------
-- Gap report helper (identity only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservation_canyon_choice_gaps(
  p_product_prefix text DEFAULT 'MDGC'
)
RETURNS TABLE (
  reservation_id text,
  product_id text,
  tour_date date,
  total_people integer,
  has_reservation_choices boolean,
  status text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    r.id,
    r.product_id,
    r.tour_date,
    r.total_people,
    EXISTS (SELECT 1 FROM public.reservation_choices rc WHERE rc.reservation_id = r.id),
    r.status
  FROM public.reservations r
  WHERE r.product_id ILIKE p_product_prefix || '%'
    AND COALESCE(r.archive, false) = false
    AND COALESCE(r.status, '') NOT IN ('canceled', 'cancelled')
    AND COALESCE(r.total_people, 0) > 0
    AND r.canyon_choice IS NULL
  ORDER BY r.tour_date DESC, r.id;
$$;

COMMENT ON FUNCTION public.reservation_canyon_choice_gaps(text) IS
  'Active reservations still missing canyon_choice after backfill.';

-- ---------------------------------------------------------------------------
-- Schedule RPC: left join + stored canyon_key (do not drop rows with null option_id)
-- ---------------------------------------------------------------------------
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
  'Schedule view payload; reservationChoices include stored canyon_key for OTA-ready counts.';
