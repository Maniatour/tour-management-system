-- Team Board: Announcements, Comments, Acknowledgments, and OP ToDos

-- Enable required extensions (no-op if already enabled)
DO $$ BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

-- Announcements
CREATE TABLE IF NOT EXISTS public.team_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_announcements_created_at ON public.team_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_announcements_is_pinned ON public.team_announcements(is_pinned);

-- Comments on announcements
CREATE TABLE IF NOT EXISTS public.team_announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.team_announcements(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_announcement_comments_announcement_id ON public.team_announcement_comments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_team_announcement_comments_created_at ON public.team_announcement_comments(created_at DESC);

-- Read acknowledgments (check/confirm)
CREATE TABLE IF NOT EXISTS public.team_announcement_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.team_announcements(id) ON DELETE CASCADE,
  ack_by VARCHAR(255) NOT NULL,
  ack_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, ack_by)
);

CREATE INDEX IF NOT EXISTS idx_team_announcement_acks_announcement_id ON public.team_announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_team_announcement_acks_ack_by ON public.team_announcement_acknowledgments(ack_by);

-- OP ToDos
CREATE TABLE IF NOT EXISTS public.op_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('common','individual')),
  category TEXT NOT NULL CHECK (category IN ('daily','monthly','yearly')),
  assigned_to VARCHAR(255), -- null for common scope
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_todos_scope_category ON public.op_todos(scope, category);
CREATE INDEX IF NOT EXISTS idx_op_todos_assigned_to ON public.op_todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_op_todos_completed ON public.op_todos(completed);

-- RLS
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcement_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_todos ENABLE ROW LEVEL SECURITY;

-- Helper expression for team membership
-- We assume emails are compared case-insensitively

-- Announcements policies
DROP POLICY IF EXISTS "team_announcements_select" ON public.team_announcements;
CREATE POLICY "team_announcements_select" ON public.team_announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_announcements_insert" ON public.team_announcements;
CREATE POLICY "team_announcements_insert" ON public.team_announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_announcements_update" ON public.team_announcements;
CREATE POLICY "team_announcements_update" ON public.team_announcements
  FOR UPDATE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "team_announcements_delete" ON public.team_announcements;
CREATE POLICY "team_announcements_delete" ON public.team_announcements
  FOR DELETE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
  );

-- Comments policies
DROP POLICY IF EXISTS "team_announcement_comments_select" ON public.team_announcement_comments;
CREATE POLICY "team_announcement_comments_select" ON public.team_announcement_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_announcement_comments_insert" ON public.team_announcement_comments;
CREATE POLICY "team_announcement_comments_insert" ON public.team_announcement_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_announcement_comments_delete" ON public.team_announcement_comments;
CREATE POLICY "team_announcement_comments_delete" ON public.team_announcement_comments
  FOR DELETE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
  );

-- Acknowledgments policies
DROP POLICY IF EXISTS "team_announcement_acks_select" ON public.team_announcement_acknowledgments;
CREATE POLICY "team_announcement_acks_select" ON public.team_announcement_acknowledgments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "team_announcement_acks_insert" ON public.team_announcement_acknowledgments;
CREATE POLICY "team_announcement_acks_insert" ON public.team_announcement_acknowledgments
  FOR INSERT WITH CHECK (
    lower(ack_by) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "team_announcement_acks_delete" ON public.team_announcement_acknowledgments;
CREATE POLICY "team_announcement_acks_delete" ON public.team_announcement_acknowledgments
  FOR DELETE USING (
    lower(ack_by) = lower(auth.jwt() ->> 'email')
  );

-- OP ToDos policies
DROP POLICY IF EXISTS "op_todos_select" ON public.op_todos;
CREATE POLICY "op_todos_select" ON public.op_todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "op_todos_insert" ON public.op_todos;
CREATE POLICY "op_todos_insert" ON public.op_todos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "op_todos_update" ON public.op_todos;
CREATE POLICY "op_todos_update" ON public.op_todos
  FOR UPDATE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
    OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "op_todos_delete" ON public.op_todos;
CREATE POLICY "op_todos_delete" ON public.op_todos
  FOR DELETE USING (
    lower(created_by) = lower(auth.jwt() ->> 'email')
  );

-- Comments
COMMENT ON TABLE public.team_announcements IS '팀 공지/전달사항 게시판';
COMMENT ON TABLE public.team_announcement_comments IS '공지에 대한 댓글/응답';
COMMENT ON TABLE public.team_announcement_acknowledgments IS '공지 확인/확인함 기록';
COMMENT ON TABLE public.op_todos IS 'OP 공통/개별 ToDo (daily/monthly/yearly)';


