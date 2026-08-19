-- 투어 영수증(현장 결제) → 입장권 부킹 이관. 한 영수증은 부킹 1건만.
-- tour_expenses.id 는 text.

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS tour_expense_id text;

COMMENT ON COLUMN public.ticket_bookings.tour_expense_id IS
  '현장 결제 투어 영수증(tour_expenses)에서 넘긴 입장권 부킹. 정산 이중 집계를 피하려면 expense는 0으로 둔다.';

ALTER TABLE public.ticket_bookings
  DROP CONSTRAINT IF EXISTS ticket_bookings_tour_expense_id_fkey;

ALTER TABLE public.ticket_bookings
  ADD CONSTRAINT ticket_bookings_tour_expense_id_fkey
  FOREIGN KEY (tour_expense_id)
  REFERENCES public.tour_expenses(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_bookings_tour_expense_id_uidx
  ON public.ticket_bookings (tour_expense_id)
  WHERE tour_expense_id IS NOT NULL;
