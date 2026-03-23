-- Team Board status/audit logs

CREATE TABLE IF NOT EXISTS public.team_board_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('task', 'announcement', 'issue')),
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('completed', 'deleted', 'restored', 'status_changed')),
  from_state text,
  to_state text,
  note text,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_board_status_logs_target
  ON public.team_board_status_logs(target_type, target_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_board_status_logs_changed_by
  ON public.team_board_status_logs(changed_by);

ALTER TABLE public.team_board_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_board_status_logs_select" ON public.team_board_status_logs;
CREATE POLICY "team_board_status_logs_select" ON public.team_board_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
        AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_board_status_logs_insert" ON public.team_board_status_logs;
CREATE POLICY "team_board_status_logs_insert" ON public.team_board_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
        AND t.is_active = true
    )
    AND lower(changed_by) = lower(auth.jwt() ->> 'email')
  );

