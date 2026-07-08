-- Office Schedule: 0:00~9:00 블록(0) + 9~23시 시간대 지원
ALTER TABLE public.office_schedule_slots
  DROP CONSTRAINT IF EXISTS office_schedule_slots_hour_slot_check;

ALTER TABLE public.office_schedule_slots
  ADD CONSTRAINT office_schedule_slots_hour_slot_check
  CHECK (hour_slot >= 0 AND hour_slot <= 23);

COMMENT ON COLUMN public.office_schedule_slots.hour_slot IS
  '시간대: 0=0:00~9:00 블록, 9~23=해당 시 시작 1시간(9=9:00~10:00)';
