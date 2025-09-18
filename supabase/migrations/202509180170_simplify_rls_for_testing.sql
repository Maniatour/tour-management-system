-- Simplify RLS policies for testing - temporarily allow all authenticated users
-- This is for debugging purposes only

-- Temporarily disable RLS for op_todos to test
ALTER TABLE public.op_todos DISABLE ROW LEVEL SECURITY;

-- Or create a very permissive policy for testing
-- ALTER TABLE public.op_todos ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "op_todos_select" ON public.op_todos;
-- DROP POLICY IF EXISTS "op_todos_insert" ON public.op_todos;
-- DROP POLICY IF EXISTS "op_todos_update" ON public.op_todos;
-- DROP POLICY IF EXISTS "op_todos_delete" ON public.op_todos;

-- CREATE POLICY "op_todos_allow_all_authenticated" ON public.op_todos
--   FOR ALL USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');
