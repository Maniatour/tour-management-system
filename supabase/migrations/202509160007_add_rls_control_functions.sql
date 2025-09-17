-- Add functions to temporarily disable/enable RLS for data sync
-- This allows data sync to work without RLS restrictions

begin;

-- Function to disable RLS for a specific table
create or replace function public.disable_rls_for_sync(table_name text)
returns void
language plpgsql
security definer
as $$
begin
  execute format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_name);
end;
$$;

-- Function to enable RLS for a specific table
create or replace function public.enable_rls_for_sync(table_name text)
returns void
language plpgsql
security definer
as $$
begin
  execute format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
end;
$$;

-- Grant execute permissions to authenticated users
grant execute on function public.disable_rls_for_sync(text) to authenticated;
grant execute on function public.enable_rls_for_sync(text) to authenticated;

commit;
