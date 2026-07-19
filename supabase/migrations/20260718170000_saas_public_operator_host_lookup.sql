-- Phase 5e: public host → operator_id lookup (anon-safe, minimal columns)
-- Middleware resolves subdomain without exposing Connect secrets / plan_limits.

CREATE OR REPLACE FUNCTION public.lookup_operator_id_by_subdomain(p_sub text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.operators o
  WHERE o.status IN ('active', 'pending')
    AND o.subdomain IS NOT NULL
    AND lower(trim(o.subdomain)) = lower(trim(p_sub))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_operator_id_by_subdomain(text) IS
  'Phase 5e: anon/middleware resolves active operator by subdomain label only.';

GRANT EXECUTE ON FUNCTION public.lookup_operator_id_by_subdomain(text)
  TO anon, authenticated, service_role;

-- Optional: custom_domain lookup stub for later (same minimal surface)
CREATE OR REPLACE FUNCTION public.lookup_operator_id_by_custom_domain(p_host text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.operators o
  WHERE o.status IN ('active', 'pending')
    AND o.custom_domain IS NOT NULL
    AND lower(trim(o.custom_domain)) = lower(trim(p_host))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_operator_id_by_custom_domain(text) IS
  'Phase 5e stub: custom domain → operator_id (routing consumer later).';

GRANT EXECUTE ON FUNCTION public.lookup_operator_id_by_custom_domain(text)
  TO anon, authenticated, service_role;
