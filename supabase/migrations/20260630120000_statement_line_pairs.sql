-- 명세 대조: 출금(지출) 줄 ↔ 수입(환불·입금) 줄 상계 연결 (티켓 환불 등)
begin;

CREATE TABLE IF NOT EXISTS public.statement_line_pairs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  outflow_line_id TEXT NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  inflow_line_id TEXT NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  note TEXT,
  ticket_booking_id TEXT REFERENCES public.ticket_bookings(id) ON DELETE SET NULL,
  linked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT statement_line_pairs_distinct_lines CHECK (outflow_line_id <> inflow_line_id),
  CONSTRAINT statement_line_pairs_unique_pair UNIQUE (outflow_line_id, inflow_line_id)
);

CREATE INDEX IF NOT EXISTS idx_statement_line_pairs_outflow
  ON public.statement_line_pairs(outflow_line_id);
CREATE INDEX IF NOT EXISTS idx_statement_line_pairs_inflow
  ON public.statement_line_pairs(inflow_line_id);
CREATE INDEX IF NOT EXISTS idx_statement_line_pairs_ticket_booking
  ON public.statement_line_pairs(ticket_booking_id)
  WHERE ticket_booking_id IS NOT NULL;

COMMENT ON TABLE public.statement_line_pairs IS
  '명세 출금·수입 줄 상계(환불·크레딧 등). reconciliation_matches(운영 원장)와 별도.';

-- 방향 검증: outflow_line_id는 outflow, inflow_line_id는 inflow
CREATE OR REPLACE FUNCTION public.validate_statement_line_pair_directions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_out_dir text;
  v_in_dir text;
BEGIN
  SELECT direction INTO v_out_dir FROM public.statement_lines WHERE id = NEW.outflow_line_id;
  SELECT direction INTO v_in_dir FROM public.statement_lines WHERE id = NEW.inflow_line_id;
  IF v_out_dir IS DISTINCT FROM 'outflow' THEN
    RAISE EXCEPTION 'outflow_line_id must reference a statement line with direction=outflow (got %)', v_out_dir;
  END IF;
  IF v_in_dir IS DISTINCT FROM 'inflow' THEN
    RAISE EXCEPTION 'inflow_line_id must reference a statement line with direction=inflow (got %)', v_in_dir;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_statement_line_pair_directions ON public.statement_line_pairs;
CREATE TRIGGER trg_validate_statement_line_pair_directions
  BEFORE INSERT OR UPDATE ON public.statement_line_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_statement_line_pair_directions();

ALTER TABLE public.statement_line_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statement_line_pairs_select_staff" ON public.statement_line_pairs;
DROP POLICY IF EXISTS "statement_line_pairs_insert_staff" ON public.statement_line_pairs;
DROP POLICY IF EXISTS "statement_line_pairs_update_staff" ON public.statement_line_pairs;
DROP POLICY IF EXISTS "statement_line_pairs_delete_staff" ON public.statement_line_pairs;

REVOKE ALL ON TABLE public.statement_line_pairs FROM anon;

CREATE POLICY "statement_line_pairs_select_staff"
  ON public.statement_line_pairs FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "statement_line_pairs_insert_staff"
  ON public.statement_line_pairs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "statement_line_pairs_update_staff"
  ON public.statement_line_pairs FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "statement_line_pairs_delete_staff"
  ON public.statement_line_pairs FOR DELETE TO authenticated
  USING (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.statement_line_pairs TO authenticated, service_role;

commit;
