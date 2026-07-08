-- Office Schedule: 단일 RPC로 삭제·upsert 배치 저장 (트랜잭션)

CREATE OR REPLACE FUNCTION public.can_edit_all_office_schedule()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team t
    WHERE lower(t.email) = lower(public.current_email())
      AND coalesce(t.is_active, true) = true
      AND lower(coalesce(t.position, '')) IN ('super', 'office manager')
  );
$$;

COMMENT ON FUNCTION public.can_edit_all_office_schedule() IS
  'Office Schedule 전 직원 편집 권한 (super, office manager)';

CREATE OR REPLACE FUNCTION public.save_office_schedule_slots(
  p_deletes jsonb DEFAULT '[]'::jsonb,
  p_upserts jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller text := lower(nullif(trim(public.current_email()), ''));
  v_can_all boolean;
  r jsonb;
  em text;
  slot int;
  d date;
  deleted_count int := 0;
  upserted_count int := 0;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  v_can_all := public.can_edit_all_office_schedule();

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

  RETURN jsonb_build_object(
    'deleted', deleted_count,
    'upserted', upserted_count
  );
END;
$$;

COMMENT ON FUNCTION public.save_office_schedule_slots(jsonb, jsonb) IS
  'Office Schedule 변경분 일괄 저장 (delete + upsert, 단일 트랜잭션)';

GRANT EXECUTE ON FUNCTION public.save_office_schedule_slots(jsonb, jsonb) TO authenticated;
