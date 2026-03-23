-- Fix helper functions used by RLS policies to support current team.position values.
-- Current app values are lowercase (admin/manager/tour guide/op/driver),
-- while some legacy policies/functions still reference old title-cased values.

CREATE OR REPLACE FUNCTION public.is_admin_user(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team
    WHERE lower(email) = lower(p_email)
      AND is_active = true
      AND lower(coalesce(position, '')) IN (
        'super',
        'office manager',
        'admin',
        'manager'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_data(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team
    WHERE lower(email) = lower(p_email)
      AND is_active = true
      AND lower(coalesce(position, '')) IN (
        'super',
        'office manager',
        'tour guide',
        'op',
        'admin',
        'manager'
      )
  );
$$;
