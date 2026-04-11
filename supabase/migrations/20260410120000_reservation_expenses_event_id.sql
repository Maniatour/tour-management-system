-- Add event_id if missing (API and UI send this field; older tables may lack it)

begin;

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_event_id
  ON public.reservation_expenses (event_id);

commit;
