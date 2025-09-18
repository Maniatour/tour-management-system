-- Enhance Team Board schema: recipients, archive, priority, tags, due_by, and links

-- team_announcements: add new columns
ALTER TABLE public.team_announcements
  ADD COLUMN IF NOT EXISTS recipients text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('low','normal','high','urgent')) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS due_by timestamptz,
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- link table: announcement-to-op_todos (optional many-to-many)
CREATE TABLE IF NOT EXISTS public.team_announcement_todo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.team_announcements(id) ON DELETE CASCADE,
  todo_id uuid NOT NULL REFERENCES public.op_todos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, todo_id)
);

ALTER TABLE public.team_announcement_todo_links ENABLE ROW LEVEL SECURITY;

-- Policies: team members can view; creator of announcement or todo can manage
DROP POLICY IF EXISTS "team_announcement_todo_links_select" ON public.team_announcement_todo_links;
CREATE POLICY "team_announcement_todo_links_select" ON public.team_announcement_todo_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.team t WHERE lower(t.email)=lower(auth.jwt()->>'email') AND t.is_active=true)
  );

DROP POLICY IF EXISTS "team_announcement_todo_links_ins" ON public.team_announcement_todo_links;
CREATE POLICY "team_announcement_todo_links_ins" ON public.team_announcement_todo_links
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.team t WHERE lower(t.email)=lower(auth.jwt()->>'email') AND t.is_active=true)
  );

DROP POLICY IF EXISTS "team_announcement_todo_links_del" ON public.team_announcement_todo_links;
CREATE POLICY "team_announcement_todo_links_del" ON public.team_announcement_todo_links
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.team t WHERE lower(t.email)=lower(auth.jwt()->>'email') AND t.is_active=true)
  );

-- RLS refinement for announcements: recipients can view; creator manage; admins blanket via existing logic
DROP POLICY IF EXISTS "team_announcements_select" ON public.team_announcements;
CREATE POLICY "team_announcements_select" ON public.team_announcements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.team t WHERE lower(t.email)=lower(auth.jwt()->>'email') AND t.is_active=true)
    AND (
      -- visible when no recipients specified (broadcast)
      (recipients IS NULL OR array_length(recipients,1) IS NULL)
      OR (lower(auth.jwt()->>'email') = lower(created_by))
      OR (recipients @> ARRAY[lower(auth.jwt()->>'email')])
    )
  );

DROP POLICY IF EXISTS "team_announcements_insert" ON public.team_announcements;
CREATE POLICY "team_announcements_insert" ON public.team_announcements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.team t WHERE lower(t.email)=lower(auth.jwt()->>'email') AND t.is_active=true)
  );

DROP POLICY IF EXISTS "team_announcements_update" ON public.team_announcements;
CREATE POLICY "team_announcements_update" ON public.team_announcements
  FOR UPDATE USING (
    lower(created_by) = lower(auth.jwt()->>'email')
  );

DROP POLICY IF EXISTS "team_announcements_delete" ON public.team_announcements;
CREATE POLICY "team_announcements_delete" ON public.team_announcements
  FOR DELETE USING (
    lower(created_by) = lower(auth.jwt()->>'email')
  );

-- RLS refinement for acknowledgments: allow recipients or creator
DROP POLICY IF EXISTS "team_announcement_acks_select" ON public.team_announcement_acknowledgments;
CREATE POLICY "team_announcement_acks_select" ON public.team_announcement_acknowledgments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_announcements a
      WHERE a.id = team_announcement_acknowledgments.announcement_id
        AND (
          (a.recipients IS NULL OR array_length(a.recipients,1) IS NULL)
          OR lower(a.created_by) = lower(auth.jwt()->>'email')
          OR a.recipients @> ARRAY[lower(auth.jwt()->>'email')]
        )
    )
  );

DROP POLICY IF EXISTS "team_announcement_acks_insert" ON public.team_announcement_acknowledgments;
CREATE POLICY "team_announcement_acks_insert" ON public.team_announcement_acknowledgments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_announcements a
      WHERE a.id = team_announcement_acknowledgments.announcement_id
        AND (
          (a.recipients IS NULL OR array_length(a.recipients,1) IS NULL)
          OR a.recipients @> ARRAY[lower(auth.jwt()->>'email')]
        )
    )
    AND lower(team_announcement_acknowledgments.ack_by) = lower(auth.jwt()->>'email')
  );

-- Comments follow same visibility as select policy on announcements
DROP POLICY IF EXISTS "team_announcement_comments_select" ON public.team_announcement_comments;
CREATE POLICY "team_announcement_comments_select" ON public.team_announcement_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_announcements a
      WHERE a.id = team_announcement_comments.announcement_id
        AND (
          (a.recipients IS NULL OR array_length(a.recipients,1) IS NULL)
          OR lower(a.created_by) = lower(auth.jwt()->>'email')
          OR a.recipients @> ARRAY[lower(auth.jwt()->>'email')]
        )
    )
  );

DROP POLICY IF EXISTS "team_announcement_comments_insert" ON public.team_announcement_comments;
CREATE POLICY "team_announcement_comments_insert" ON public.team_announcement_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_announcements a
      WHERE a.id = team_announcement_comments.announcement_id
        AND (
          (a.recipients IS NULL OR array_length(a.recipients,1) IS NULL)
          OR a.recipients @> ARRAY[lower(auth.jwt()->>'email')]
        )
    )
  );

COMMENT ON COLUMN public.team_announcements.recipients IS 'Lowercased email array of target recipients; empty means broadcast';
COMMENT ON COLUMN public.team_announcements.priority IS 'low | normal | high | urgent';
COMMENT ON COLUMN public.team_announcements.tags IS 'Free-form tags';
COMMENT ON COLUMN public.team_announcements.due_by IS 'Optional due timestamp';
COMMENT ON COLUMN public.team_announcements.is_archived IS 'Archive flag for completed announcements';
COMMENT ON TABLE public.team_announcement_todo_links IS 'Links announcements to generated OP todos';


