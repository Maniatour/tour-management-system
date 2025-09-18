-- Fix op_todos RLS policies to allow team members to create todos
-- Include "Super" position in the allowed positions

-- Drop existing policies
DROP POLICY IF EXISTS "op_todos_select" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_insert" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_update" ON public.op_todos;
DROP POLICY IF EXISTS "op_todos_delete" ON public.op_todos;

-- Create new policies that allow team members (including Super position)
CREATE POLICY "op_todos_select" ON public.op_todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    )
  );

CREATE POLICY "op_todos_insert" ON public.op_todos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    ) AND
    created_by = auth.jwt() ->> 'email'
  );

CREATE POLICY "op_todos_update" ON public.op_todos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    ) AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    ) AND (
      lower(created_by) = lower(auth.jwt() ->> 'email')
      OR (assigned_to IS NOT NULL AND lower(assigned_to) = lower(auth.jwt() ->> 'email'))
    )
  );

CREATE POLICY "op_todos_delete" ON public.op_todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team t 
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email') AND t.is_active = true
    ) AND
    lower(created_by) = lower(auth.jwt() ->> 'email')
  );
