-- 패스워드 금고 접근: Super / Office Manager / Manager (OP 제외)
BEGIN;

CREATE OR REPLACE FUNCTION public.staff_credential_vault_can_access(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team t
    WHERE lower(t.email) = lower(coalesce(p_email, ''))
      AND t.is_active IS NOT FALSE
      AND (
        lower(coalesce(t.position, '')) = 'super'
        OR lower(coalesce(t.position, '')) LIKE '%manager%'
        OR lower(coalesce(t.position, '')) LIKE '%office%'
      )
      AND lower(coalesce(t.position, '')) <> 'op'
  )
  OR lower(coalesce(p_email, '')) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com');
$$;

COMMENT ON FUNCTION public.staff_credential_vault_can_access(text) IS
  '자격 증명 금고 접근: Super / Office Manager / Manager (OP 제외)';

COMMIT;
