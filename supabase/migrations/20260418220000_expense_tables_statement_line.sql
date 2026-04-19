-- 명세 보정·대조 시 지출 원장과 명세 줄을 양방향으로 추적
begin;

ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS statement_line_id TEXT REFERENCES public.statement_lines(id) ON DELETE SET NULL;

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS statement_line_id TEXT REFERENCES public.statement_lines(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS statement_line_id TEXT REFERENCES public.statement_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_statement_line ON public.tour_expenses(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_reservation_expenses_statement_line ON public.reservation_expenses(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_statement_line ON public.ticket_bookings(statement_line_id);

COMMENT ON COLUMN public.tour_expenses.statement_line_id IS '명세 대조로 생성·연결된 경우 해당 명세 줄';
COMMENT ON COLUMN public.reservation_expenses.statement_line_id IS '명세 대조로 생성·연결된 경우 해당 명세 줄';
COMMENT ON COLUMN public.ticket_bookings.statement_line_id IS '명세 대조로 생성·연결된 경우 해당 명세 줄';

commit;
