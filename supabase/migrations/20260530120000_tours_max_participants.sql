-- 투어별 최대 수용 인원 (기본 12). 배차(tour_car_id) 변경 시 차종 관리 정원으로 자동 반영.

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS max_participants integer NOT NULL DEFAULT 12;

COMMENT ON COLUMN public.tours.max_participants IS '투어 최대 수용 인원. 기본 12. 차량 배차 저장 시 vehicle_types.passenger_capacity(없으면 vehicles.capacity)로 자동 조정.';

-- 기존 데이터: 배차된 차가 있으면 차종 정원으로 맞춤
UPDATE public.tours t
SET max_participants = sub.cap
FROM (
  SELECT
    t2.id AS tour_id,
    COALESCE(vt.passenger_capacity, v.capacity, 12) AS cap
  FROM public.tours t2
  INNER JOIN public.vehicles v ON v.id::text = trim(t2.tour_car_id::text)
  LEFT JOIN public.vehicle_types vt ON vt.name = v.vehicle_type
  WHERE t2.tour_car_id IS NOT NULL AND trim(t2.tour_car_id::text) <> ''
) sub
WHERE t.id = sub.tour_id;

CREATE OR REPLACE FUNCTION public.tours_sync_max_participants_from_vehicle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tour_car_id IS NOT NULL AND trim(NEW.tour_car_id::text) <> '' THEN
      SELECT COALESCE(vt.passenger_capacity, v.capacity, 12)
      INTO v_cap
      FROM public.vehicles v
      LEFT JOIN public.vehicle_types vt ON vt.name = v.vehicle_type
      WHERE v.id::text = trim(NEW.tour_car_id::text)
      LIMIT 1;
      IF v_cap IS NOT NULL THEN
        NEW.max_participants := v_cap;
      ELSE
        NEW.max_participants := COALESCE(NEW.max_participants, 12);
      END IF;
    ELSE
      NEW.max_participants := COALESCE(NEW.max_participants, 12);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.tour_car_id IS DISTINCT FROM OLD.tour_car_id THEN
      IF NEW.tour_car_id IS NOT NULL AND trim(NEW.tour_car_id::text) <> '' THEN
        SELECT COALESCE(vt.passenger_capacity, v.capacity, 12)
        INTO v_cap
        FROM public.vehicles v
        LEFT JOIN public.vehicle_types vt ON vt.name = v.vehicle_type
        WHERE v.id::text = trim(NEW.tour_car_id::text)
        LIMIT 1;
        IF v_cap IS NOT NULL THEN
          NEW.max_participants := v_cap;
        END IF;
      ELSE
        NEW.max_participants := 12;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tours_sync_max_participants_from_vehicle ON public.tours;

CREATE TRIGGER tours_sync_max_participants_from_vehicle
  BEFORE INSERT OR UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.tours_sync_max_participants_from_vehicle();
