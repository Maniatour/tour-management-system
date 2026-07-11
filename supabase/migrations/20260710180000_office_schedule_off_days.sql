-- Office Schedule: 직원별 필수 휴무(OFF) 일정

CREATE TABLE IF NOT EXISTS public.office_schedule_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email VARCHAR(255) NOT NULL,
  schedule_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_email, schedule_date)
);

CREATE INDEX IF NOT EXISTS idx_office_schedule_off_days_date
  ON public.office_schedule_off_days (schedule_date);

CREATE INDEX IF NOT EXISTS idx_office_schedule_off_days_employee
  ON public.office_schedule_off_days (employee_email);

CREATE INDEX IF NOT EXISTS idx_office_schedule_off_days_employee_date
  ON public.office_schedule_off_days (employee_email, schedule_date);

COMMENT ON TABLE public.office_schedule_off_days IS
  'Office Schedule 직원별 필수 휴무(OFF) — 해당 일에는 근무 배정 없음';

ALTER TABLE public.office_schedule_off_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_schedule_off_days_select_all" ON public.office_schedule_off_days;
CREATE POLICY "office_schedule_off_days_select_all" ON public.office_schedule_off_days
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "office_schedule_off_days_modify_staff" ON public.office_schedule_off_days;
CREATE POLICY "office_schedule_off_days_modify_staff" ON public.office_schedule_off_days
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

ALTER TABLE public.office_schedule_revisions
  ADD COLUMN IF NOT EXISTS off_days JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.office_schedule_revisions.off_days IS
  'OFF day 스냅샷 [{employee_email, schedule_date, note}]';

CREATE OR REPLACE FUNCTION public.save_office_schedule_slots(
  p_deletes jsonb DEFAULT '[]'::jsonb,
  p_upserts jsonb DEFAULT '[]'::jsonb,
  p_scope_month text DEFAULT NULL,
  p_snapshot_from date DEFAULT NULL,
  p_snapshot_to date DEFAULT NULL,
  p_off_deletes jsonb DEFAULT '[]'::jsonb,
  p_off_upserts jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller text := lower(nullif(trim(public.current_email()), ''));
  v_caller_raw text := nullif(trim(public.current_email()), '');
  v_caller_name text;
  v_can_all boolean;
  r jsonb;
  em text;
  slot int;
  d date;
  deleted_count int := 0;
  upserted_count int := 0;
  off_deleted_count int := 0;
  off_upserted_count int := 0;
  snap_from date;
  snap_to date;
  snap_slots jsonb;
  snap_off_days jsonb;
  rev_id uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  v_can_all := public.can_edit_all_office_schedule();

  SELECT coalesce(nullif(trim(t.display_name), ''), nullif(trim(t.name_en), ''), nullif(trim(t.name_ko), ''))
  INTO v_caller_name
  FROM public.team t
  WHERE lower(t.email) = v_caller
  LIMIT 1;

  IF jsonb_typeof(coalesce(p_deletes, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_upserts, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_off_deletes, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_off_upserts, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_deletes, p_upserts, p_off_deletes, p_off_upserts must be json arrays';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_deletes, '[]'::jsonb))
  LOOP
    em := lower(nullif(trim(r->>'employee_email'), ''));
    d := nullif(trim(r->>'schedule_date'), '')::date;
    slot := (r->>'hour_slot')::int;

    IF em IS NULL OR d IS NULL OR slot IS NULL THEN
      RAISE EXCEPTION 'invalid delete row: %', r;
    END IF;
    IF slot < 0 OR slot > 23 THEN
      RAISE EXCEPTION 'invalid hour_slot on delete: %', slot;
    END IF;
    IF NOT v_can_all AND em <> v_caller THEN
      RAISE EXCEPTION 'cannot delete other staff schedule' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.office_schedule_slots
    WHERE lower(employee_email) = em
      AND schedule_date = d
      AND hour_slot = slot;

    deleted_count := deleted_count + 1;
  END LOOP;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb))
  LOOP
    em := lower(nullif(trim(r->>'employee_email'), ''));
    d := nullif(trim(r->>'schedule_date'), '')::date;
    slot := (r->>'hour_slot')::int;

    IF em IS NULL OR d IS NULL OR slot IS NULL THEN
      RAISE EXCEPTION 'invalid upsert row: %', r;
    END IF;
    IF slot < 0 OR slot > 23 THEN
      RAISE EXCEPTION 'invalid hour_slot on upsert: %', slot;
    END IF;
    IF NOT v_can_all AND em <> v_caller THEN
      RAISE EXCEPTION 'cannot upsert other staff schedule' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.office_schedule_slots (
      employee_email,
      schedule_date,
      hour_slot,
      note,
      updated_at
    )
    VALUES (
      r->>'employee_email',
      d,
      slot,
      nullif(trim(r->>'note'), ''),
      now()
    )
    ON CONFLICT (employee_email, schedule_date, hour_slot)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = now();

    upserted_count := upserted_count + 1;
  END LOOP;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_off_deletes, '[]'::jsonb))
  LOOP
    em := lower(nullif(trim(r->>'employee_email'), ''));
    d := nullif(trim(r->>'schedule_date'), '')::date;

    IF em IS NULL OR d IS NULL THEN
      RAISE EXCEPTION 'invalid off delete row: %', r;
    END IF;
    IF NOT v_can_all AND em <> v_caller THEN
      RAISE EXCEPTION 'cannot delete other staff off day' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.office_schedule_off_days
    WHERE lower(employee_email) = em
      AND schedule_date = d;

    off_deleted_count := off_deleted_count + 1;
  END LOOP;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_off_upserts, '[]'::jsonb))
  LOOP
    em := lower(nullif(trim(r->>'employee_email'), ''));
    d := nullif(trim(r->>'schedule_date'), '')::date;

    IF em IS NULL OR d IS NULL THEN
      RAISE EXCEPTION 'invalid off upsert row: %', r;
    END IF;
    IF NOT v_can_all AND em <> v_caller THEN
      RAISE EXCEPTION 'cannot upsert other staff off day' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.office_schedule_off_days (
      employee_email,
      schedule_date,
      note,
      updated_at
    )
    VALUES (
      r->>'employee_email',
      d,
      nullif(trim(r->>'note'), ''),
      now()
    )
    ON CONFLICT (employee_email, schedule_date)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = now();

    off_upserted_count := off_upserted_count + 1;
  END LOOP;

  snap_from := p_snapshot_from;
  snap_to := p_snapshot_to;
  IF snap_from IS NOT NULL AND snap_to IS NOT NULL AND snap_from <= snap_to THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'employee_email', s.employee_email,
        'schedule_date', to_char(s.schedule_date, 'YYYY-MM-DD'),
        'hour_slot', s.hour_slot,
        'note', s.note
      )
      ORDER BY s.schedule_date, s.hour_slot, s.employee_email
    ), '[]'::jsonb)
    INTO snap_slots
    FROM public.office_schedule_slots s
    WHERE s.schedule_date >= snap_from
      AND s.schedule_date <= snap_to;

    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'employee_email', o.employee_email,
        'schedule_date', to_char(o.schedule_date, 'YYYY-MM-DD'),
        'note', o.note
      )
      ORDER BY o.schedule_date, o.employee_email
    ), '[]'::jsonb)
    INTO snap_off_days
    FROM public.office_schedule_off_days o
    WHERE o.schedule_date >= snap_from
      AND o.schedule_date <= snap_to;

    INSERT INTO public.office_schedule_revisions (
      scope_month,
      date_from,
      date_to,
      action,
      saved_by_email,
      saved_by_name,
      deleted_count,
      upserted_count,
      slot_count,
      slots,
      off_days
    )
    VALUES (
      coalesce(nullif(trim(p_scope_month), ''), to_char(snap_from, 'YYYY-MM')),
      snap_from,
      snap_to,
      'save',
      coalesce(v_caller_raw, v_caller),
      v_caller_name,
      deleted_count,
      upserted_count,
      coalesce(jsonb_array_length(snap_slots), 0),
      snap_slots,
      snap_off_days
    )
    RETURNING id INTO rev_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', deleted_count,
    'upserted', upserted_count,
    'off_deleted', off_deleted_count,
    'off_upserted', off_upserted_count,
    'revision_id', rev_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_office_schedule_revision(
  p_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller text := lower(nullif(trim(public.current_email()), ''));
  v_caller_raw text := nullif(trim(public.current_email()), '');
  v_caller_name text;
  rev public.office_schedule_revisions%ROWTYPE;
  r jsonb;
  em text;
  d date;
  slot int;
  snap_slots jsonb;
  snap_off_days jsonb;
  rev_id uuid;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_edit_all_office_schedule() THEN
    RAISE EXCEPTION 'restore requires office manager or super' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO rev
  FROM public.office_schedule_revisions
  WHERE id = p_revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision not found';
  END IF;

  SELECT coalesce(nullif(trim(t.display_name), ''), nullif(trim(t.name_en), ''), nullif(trim(t.name_ko), ''))
  INTO v_caller_name
  FROM public.team t
  WHERE lower(t.email) = v_caller
  LIMIT 1;

  DELETE FROM public.office_schedule_slots
  WHERE schedule_date >= rev.date_from
    AND schedule_date <= rev.date_to;

  DELETE FROM public.office_schedule_off_days
  WHERE schedule_date >= rev.date_from
    AND schedule_date <= rev.date_to;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(rev.slots, '[]'::jsonb))
  LOOP
    em := nullif(trim(r->>'employee_email'), '');
    d := nullif(trim(r->>'schedule_date'), '')::date;
    slot := (r->>'hour_slot')::int;
    IF em IS NULL OR d IS NULL OR slot IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.office_schedule_slots (
      employee_email,
      schedule_date,
      hour_slot,
      note,
      updated_at
    )
    VALUES (
      em,
      d,
      slot,
      nullif(trim(r->>'note'), ''),
      now()
    )
    ON CONFLICT (employee_email, schedule_date, hour_slot)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = now();
  END LOOP;

  FOR r IN SELECT value FROM jsonb_array_elements(coalesce(rev.off_days, '[]'::jsonb))
  LOOP
    em := nullif(trim(r->>'employee_email'), '');
    d := nullif(trim(r->>'schedule_date'), '')::date;
    IF em IS NULL OR d IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.office_schedule_off_days (
      employee_email,
      schedule_date,
      note,
      updated_at
    )
    VALUES (
      em,
      d,
      nullif(trim(r->>'note'), ''),
      now()
    )
    ON CONFLICT (employee_email, schedule_date)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = now();
  END LOOP;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_email', s.employee_email,
      'schedule_date', to_char(s.schedule_date, 'YYYY-MM-DD'),
      'hour_slot', s.hour_slot,
      'note', s.note
    )
    ORDER BY s.schedule_date, s.hour_slot, s.employee_email
  ), '[]'::jsonb)
  INTO snap_slots
  FROM public.office_schedule_slots s
  WHERE s.schedule_date >= rev.date_from
    AND s.schedule_date <= rev.date_to;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_email', o.employee_email,
      'schedule_date', to_char(o.schedule_date, 'YYYY-MM-DD'),
      'note', o.note
    )
    ORDER BY o.schedule_date, o.employee_email
  ), '[]'::jsonb)
  INTO snap_off_days
  FROM public.office_schedule_off_days o
  WHERE o.schedule_date >= rev.date_from
    AND o.schedule_date <= rev.date_to;

  INSERT INTO public.office_schedule_revisions (
    scope_month,
    date_from,
    date_to,
    action,
    restored_from_id,
    saved_by_email,
    saved_by_name,
    deleted_count,
    upserted_count,
    slot_count,
    slots,
    off_days
  )
  VALUES (
    rev.scope_month,
    rev.date_from,
    rev.date_to,
    'restore',
    rev.id,
    coalesce(v_caller_raw, v_caller),
    v_caller_name,
    0,
    coalesce(jsonb_array_length(rev.slots), 0),
    coalesce(jsonb_array_length(snap_slots), 0),
    snap_slots,
    snap_off_days
  )
  RETURNING id INTO rev_id;

  RETURN jsonb_build_object(
    'revision_id', rev_id,
    'restored_from_id', rev.id,
    'slot_count', coalesce(jsonb_array_length(snap_slots), 0),
    'off_day_count', coalesce(jsonb_array_length(snap_off_days), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_office_schedule_slots(jsonb, jsonb, text, date, date, jsonb, jsonb) TO authenticated;
