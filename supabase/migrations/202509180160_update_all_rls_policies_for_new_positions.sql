-- Update all RLS policies to use new position structure
-- Positions: Super, Office Manager, Tour Guide, OP, Driver

-- Helper function to check if user has admin privileges
CREATE OR REPLACE FUNCTION public.is_admin_user(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team 
    WHERE lower(email) = lower(p_email) 
    AND is_active = true 
    AND position IN ('Super', 'Office Manager')
  );
$$;

-- Helper function to check if user is team member
CREATE OR REPLACE FUNCTION public.is_team_member(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team 
    WHERE lower(email) = lower(p_email) 
    AND is_active = true
  );
$$;

-- Helper function to check if user can manage data
CREATE OR REPLACE FUNCTION public.can_manage_data(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team 
    WHERE lower(email) = lower(p_email) 
    AND is_active = true 
    AND position IN ('Super', 'Office Manager', 'Tour Guide', 'OP')
  );
$$;

-- Update op_todos RLS policies
DROP POLICY IF EXISTS "op_todos_select" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_insert" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_update" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_delete" ON public.op_todos;

CREATE POLICY "op_todos_select" ON public.op_todos
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "op_todos_insert" ON public.op_todos
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND
    created_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "op_todos_update" ON public.op_todos
  FOR UPDATE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  ) WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "op_todos_delete" ON public.op_todos
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update team_announcements RLS policies
DROP POLICY IF EXISTS "team_announcements_select" ON public.team_announcements;
DROP POLICY IF EXISTS "team_announcements_insert" ON public.team_announcements;
DROP POLICY IF EXISTS "team_announcements_update" ON public.team_announcements;
DROP POLICY IF EXISTS "team_announcements_delete" ON public.team_announcements;

CREATE POLICY "team_announcements_select" ON public.team_announcements
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "team_announcements_insert" ON public.team_announcements
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND
    created_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "team_announcements_update" ON public.team_announcements
  FOR UPDATE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "team_announcements_delete" ON public.team_announcements
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update team_announcement_comments RLS policies
DROP POLICY IF EXISTS "team_announcement_comments_select" ON public.team_announcement_comments;
DROP POLICY IF EXISTS "team_announcement_comments_insert" ON public.team_announcement_comments;
DROP POLICY IF EXISTS "team_announcement_comments_delete" ON public.team_announcement_comments;

CREATE POLICY "team_announcement_comments_select" ON public.team_announcement_comments
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "team_announcement_comments_insert" ON public.team_announcement_comments
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND
    created_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "team_announcement_comments_delete" ON public.team_announcement_comments
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update team_announcement_acknowledgments RLS policies
DROP POLICY IF EXISTS "team_announcement_acks_select" ON public.team_announcement_acknowledgments;
DROP POLICY IF EXISTS "team_announcement_acks_insert" ON public.team_announcement_acknowledgments;
DROP POLICY IF EXISTS "team_announcement_acks_delete" ON public.team_announcement_acknowledgments;

CREATE POLICY "team_announcement_acks_select" ON public.team_announcement_acknowledgments
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "team_announcement_acks_insert" ON public.team_announcement_acknowledgments
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND
    lower(ack_by) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "team_announcement_acks_delete" ON public.team_announcement_acknowledgments
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(ack_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update projects RLS policies
DROP POLICY IF EXISTS "프로젝트 조회 권한" ON public.projects;
DROP POLICY IF EXISTS "프로젝트 생성 권한" ON public.projects;
DROP POLICY IF EXISTS "프로젝트 수정 권한" ON public.projects;
DROP POLICY IF EXISTS "프로젝트 삭제 권한" ON public.projects;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      created_by = auth.jwt() ->> 'email' OR
      assigned_to @> ARRAY[auth.jwt() ->> 'email'] OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    public.can_manage_data(auth.jwt() ->> 'email') AND
    created_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      created_by = auth.jwt() ->> 'email' OR
      assigned_to @> ARRAY[auth.jwt() ->> 'email'] OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  ) WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      created_by = auth.jwt() ->> 'email' OR
      assigned_to @> ARRAY[auth.jwt() ->> 'email'] OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      created_by = auth.jwt() ->> 'email' OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update issues RLS policies
DROP POLICY IF EXISTS "이슈 조회 권한" ON public.issues;
DROP POLICY IF EXISTS "이슈 생성 권한" ON public.issues;
DROP POLICY IF EXISTS "이슈 수정 권한" ON public.issues;
DROP POLICY IF EXISTS "이슈 삭제 권한" ON public.issues;

CREATE POLICY "issues_select" ON public.issues
  FOR SELECT USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      reported_by = auth.jwt() ->> 'email' OR
      assigned_to = auth.jwt() ->> 'email' OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "issues_insert" ON public.issues
  FOR INSERT WITH CHECK (
    public.can_manage_data(auth.jwt() ->> 'email') AND
    reported_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "issues_update" ON public.issues
  FOR UPDATE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      reported_by = auth.jwt() ->> 'email' OR
      assigned_to = auth.jwt() ->> 'email' OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  ) WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      reported_by = auth.jwt() ->> 'email' OR
      assigned_to = auth.jwt() ->> 'email' OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "issues_delete" ON public.issues
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      reported_by = auth.jwt() ->> 'email' OR
      public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Update product_details RLS policies
DROP POLICY IF EXISTS "product_details_staff_all" ON public.product_details;
DROP POLICY IF EXISTS "product_details_anon_read" ON public.product_details;

CREATE POLICY "product_details_team_all" ON public.product_details
  FOR ALL USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "product_details_anon_read" ON public.product_details
  FOR SELECT USING (true);

-- Update is_staff function to use new position structure
CREATE OR REPLACE FUNCTION public.is_staff(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_team_member(p_email);
$$;

-- Update product_details_common RLS policies
DROP POLICY IF EXISTS "Allow all operations on product_details_common for authenticated users" ON public.product_details_common;

CREATE POLICY "product_details_common_team_all" ON public.product_details_common
  FOR ALL USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update chat_rooms RLS policies
DROP POLICY IF EXISTS "chat_rooms_select_all" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_insert_staff" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_update_staff" ON public.chat_rooms;

CREATE POLICY "chat_rooms_select_team" ON public.chat_rooms
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_rooms_insert_team" ON public.chat_rooms
  FOR INSERT WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_rooms_update_team" ON public.chat_rooms
  FOR UPDATE USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update chat_messages RLS policies
DROP POLICY IF EXISTS "chat_messages_select_all" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert_staff" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_staff" ON public.chat_messages;

CREATE POLICY "chat_messages_select_team" ON public.chat_messages
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_messages_insert_team" ON public.chat_messages
  FOR INSERT WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_messages_update_team" ON public.chat_messages
  FOR UPDATE USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update chat_participants RLS policies
DROP POLICY IF EXISTS "chat_participants_select_all" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert_staff" ON public.chat_participants;
DROP POLICY IF EXISTS "chat_participants_update_staff" ON public.chat_participants;

CREATE POLICY "chat_participants_select_team" ON public.chat_participants
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_participants_insert_team" ON public.chat_participants
  FOR INSERT WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_participants_update_team" ON public.chat_participants
  FOR UPDATE USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update chat_announcement_templates RLS policies
DROP POLICY IF EXISTS "chat_announcement_templates_all_authenticated" ON public.chat_announcement_templates;

CREATE POLICY "chat_announcement_templates_team_all" ON public.chat_announcement_templates
  FOR ALL USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update tour_announcements RLS policies
DROP POLICY IF EXISTS "tour_announcements_all_authenticated" ON public.tour_announcements;

CREATE POLICY "tour_announcements_team_all" ON public.tour_announcements
  FOR ALL USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update chat_room_announcements RLS policies
DROP POLICY IF EXISTS "chat_room_announcements_all_authenticated" ON public.chat_room_announcements;

CREATE POLICY "chat_room_announcements_team_all" ON public.chat_room_announcements
  FOR ALL USING (public.is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

-- Update team_announcement_todo_links RLS policies
DROP POLICY IF EXISTS "team_announcement_todo_links_select" ON public.team_announcement_todo_links;
DROP POLICY IF EXISTS "team_announcement_todo_links_ins" ON public.team_announcement_todo_links;
DROP POLICY IF EXISTS "team_announcement_todo_links_del" ON public.team_announcement_todo_links;

CREATE POLICY "team_announcement_todo_links_select" ON public.team_announcement_todo_links
  FOR SELECT USING (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "team_announcement_todo_links_insert" ON public.team_announcement_todo_links
  FOR INSERT WITH CHECK (public.is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "team_announcement_todo_links_delete" ON public.team_announcement_todo_links
  FOR DELETE USING (public.is_team_member(auth.jwt() ->> 'email'));
