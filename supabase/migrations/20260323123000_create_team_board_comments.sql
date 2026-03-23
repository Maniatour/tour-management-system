-- Unified comments for Team Board items (tasks, announcements, issues)

CREATE TABLE IF NOT EXISTS public.team_board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('task', 'announcement', 'issue')),
  target_id uuid NOT NULL,
  comment text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_board_comments_target
  ON public.team_board_comments(target_type, target_id, created_at);

CREATE INDEX IF NOT EXISTS idx_team_board_comments_created_by
  ON public.team_board_comments(created_by);

ALTER TABLE public.team_board_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_board_comments_select" ON public.team_board_comments;
CREATE POLICY "team_board_comments_select" ON public.team_board_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
        AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_board_comments_insert" ON public.team_board_comments;
CREATE POLICY "team_board_comments_insert" ON public.team_board_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
        AND t.is_active = true
    )
    AND lower(created_by) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "team_board_comments_delete" ON public.team_board_comments;
CREATE POLICY "team_board_comments_delete" ON public.team_board_comments
  FOR DELETE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
    OR public.is_admin_user(auth.jwt() ->> 'email')
  );

