-- Office Schedule 저장 이력 (스냅샷 + 복원)

CREATE TABLE IF NOT EXISTS public.office_schedule_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_month CHAR(7) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  action TEXT NOT NULL DEFAULT 'save' CHECK (action IN ('save', 'restore')),
  restored_from_id UUID REFERENCES public.office_schedule_revisions(id) ON DELETE SET NULL,
  saved_by_email VARCHAR(255) NOT NULL,
  saved_by_name VARCHAR(255),
  deleted_count INT NOT NULL DEFAULT 0,
  upserted_count INT NOT NULL DEFAULT 0,
  slot_count INT NOT NULL DEFAULT 0,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_schedule_revisions_scope_month
  ON public.office_schedule_revisions (scope_month, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_office_schedule_revisions_created_at
  ON public.office_schedule_revisions (created_at DESC);

COMMENT ON TABLE public.office_schedule_revisions IS 'Office Schedule 저장·복원 스냅샷 이력';

ALTER TABLE public.office_schedule_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_schedule_revisions_select_staff" ON public.office_schedule_revisions;
CREATE POLICY "office_schedule_revisions_select_staff" ON public.office_schedule_revisions
  FOR SELECT TO authenticated
  USING (public.is_staff());

-- 저장 RPC: 변경 적용 후 스냅샷 이력 기록
CREATE OR REPLACE FUNCTION public.save_office_schedule_slots(
  p_deletes jsonb DEFAULT '[]'::jsonb,
  p_upserts jsonb DEFAULT '[]'::jsonb,
  p_scope_month text DEFAULT NULL,
  p_snapshot_from date DEFAULT NULL,
  p_snapshot_to date DEFAULT NULL
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
  snap_from date;
  snap_to date;
  snap_slots jsonb;
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
     OR jsonb_typeof(coalesce(p_upserts, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_deletes and p_upserts must be json arrays';
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
      slots
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
      snap_slots
    )
    RETURNING id INTO rev_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', deleted_count,
    'upserted', upserted_count,
    'revision_id', rev_id
  );
END;
$$;

-- 이력 목록
CREATE OR REPLACE FUNCTION public.list_office_schedule_revisions(
  p_scope_month text,
  p_limit int DEFAULT 40
)
RETURNS TABLE (
  id uuid,
  scope_month char(7),
  date_from date,
  date_to date,
  action text,
  restored_from_id uuid,
  saved_by_email varchar,
  saved_by_name varchar,
  deleted_count int,
  upserted_count int,
  slot_count int,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.scope_month,
    r.date_from,
    r.date_to,
    r.action,
    r.restored_from_id,
    r.saved_by_email,
    r.saved_by_name,
    r.deleted_count,
    r.upserted_count,
    r.slot_count,
    r.created_at
  FROM public.office_schedule_revisions r
  WHERE r.scope_month = nullif(trim(p_scope_month), '')
  ORDER BY r.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 40), 100));
END;
$$;

-- 이력 스냅샷으로 복원 (super / office manager)
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
    slots
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
    snap_slots
  )
  RETURNING id INTO rev_id;

  RETURN jsonb_build_object(
    'revision_id', rev_id,
    'restored_from_id', rev.id,
    'slot_count', coalesce(jsonb_array_length(snap_slots), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_office_schedule_slots(jsonb, jsonb, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_office_schedule_revisions(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_office_schedule_revision(uuid) TO authenticated;
