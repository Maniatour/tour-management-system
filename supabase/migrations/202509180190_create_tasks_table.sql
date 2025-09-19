-- Create tasks table for work management
CREATE TABLE IF NOT EXISTS public.tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    created_by TEXT NOT NULL,
    assigned_to TEXT,
    target_positions TEXT[],
    target_individuals TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- Create RLS policies for tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is team member
CREATE OR REPLACE FUNCTION public.is_team_member(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team 
    WHERE lower(email) = lower(user_email) 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team 
    WHERE lower(email) = lower(user_email) 
    AND is_active = true 
    AND position IN ('Super', 'Office Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Select policy: team members can view tasks assigned to them or created by them
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );

-- Insert policy: team members can create tasks
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.jwt() ->> 'email') AND
    created_by = auth.jwt() ->> 'email'
  );

-- Update policy: team members can update tasks they created or are assigned to
CREATE POLICY "tasks_update" ON public.tasks
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

-- Delete policy: only admins and task creators can delete
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    public.is_team_member(auth.jwt() ->> 'email') AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR public.is_admin_user(auth.jwt() ->> 'email')
    )
  );
