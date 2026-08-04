-- Office Manager 직책 변형(매니저, office_manager 등) RLS 인식 보강

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_site_alert_can_send(p_email text)
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
        OR lower(coalesce(t.position, '')) IN ('office manager', 'office_manager', 'manager', '매니저')
        OR lower(coalesce(t.position, '')) LIKE '%manager%'
        OR lower(coalesce(t.position, '')) = 'op'
        OR lower(coalesce(t.position, '')) = 'office'
        OR (
          lower(coalesce(t.position, '')) LIKE '%office%'
          AND lower(coalesce(t.position, '')) NOT LIKE '%manager%'
        )
      )
  )
  OR lower(coalesce(p_email, '')) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com');
$$;

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
        OR lower(coalesce(t.position, '')) IN ('office manager', 'office_manager', 'manager', '매니저')
        OR lower(coalesce(t.position, '')) LIKE '%manager%'
        OR (
          lower(coalesce(t.position, '')) LIKE '%office%'
          AND lower(coalesce(t.position, '')) NOT LIKE '%manager%'
        )
      )
      AND lower(coalesce(t.position, '')) <> 'op'
  )
  OR lower(coalesce(p_email, '')) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com');
$$;

COMMENT ON FUNCTION public.staff_site_alert_can_send(text) IS
  '사이트 알림 발송 권한: Super / Office Manager / OP / 사무직 (활성 team).';

COMMENT ON FUNCTION public.staff_credential_vault_can_access(text) IS
  '자격 증명 금고 접근: Super / Office Manager / Manager (OP 제외).';

COMMIT;
