-- 입장권 부킹 관리 달력뷰 — 날짜별 운영 노트 (예: 극성수기로 X 마감)

CREATE TABLE IF NOT EXISTS public.ticket_booking_date_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date date NOT NULL UNIQUE,
  note text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_booking_date_notes_note_date
  ON public.ticket_booking_date_notes (note_date);

COMMENT ON TABLE public.ticket_booking_date_notes IS
  '입장권 부킹 관리 달력뷰 날짜별 운영 노트';

ALTER TABLE public.ticket_booking_date_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_booking_date_notes_select_team" ON public.ticket_booking_date_notes;
CREATE POLICY "ticket_booking_date_notes_select_team"
  ON public.ticket_booking_date_notes FOR SELECT TO authenticated
  USING (public.rls_team_member_session_ok());

DROP POLICY IF EXISTS "ticket_booking_date_notes_insert_staff" ON public.ticket_booking_date_notes;
CREATE POLICY "ticket_booking_date_notes_insert_staff"
  ON public.ticket_booking_date_notes FOR INSERT TO authenticated
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "ticket_booking_date_notes_update_staff" ON public.ticket_booking_date_notes;
CREATE POLICY "ticket_booking_date_notes_update_staff"
  ON public.ticket_booking_date_notes FOR UPDATE TO authenticated
  USING (public.rls_is_staff_session_ok())
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "ticket_booking_date_notes_delete_staff" ON public.ticket_booking_date_notes;
CREATE POLICY "ticket_booking_date_notes_delete_staff"
  ON public.ticket_booking_date_notes FOR DELETE TO authenticated
  USING (public.rls_is_staff_session_ok());

CREATE OR REPLACE FUNCTION public.update_ticket_booking_date_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ticket_booking_date_notes_updated_at ON public.ticket_booking_date_notes;
CREATE TRIGGER update_ticket_booking_date_notes_updated_at
  BEFORE UPDATE ON public.ticket_booking_date_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_booking_date_notes_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_booking_date_notes TO authenticated;
