-- 직원 로그인 자격 증명 금고 (암호화 저장 · API 전용 · 열람 감사 로그)
BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_credential_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  site_url text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('ota', 'email', 'payment', 'social', 'other')),
  login_id text NOT NULL,
  password_ciphertext text NOT NULL,
  notes text,
  created_by_email text NOT NULL,
  created_by_name text,
  updated_by_email text,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_staff_credential_vault_active_category
  ON public.staff_credential_vault (category, site_name)
  WHERE is_archived IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_credential_vault_created_at
  ON public.staff_credential_vault (created_at DESC);

COMMENT ON TABLE public.staff_credential_vault IS 'OTA·사이트 로그인 자격 증명 (비밀번호는 서버 AES-256-GCM 암호화, API 경유만)';
COMMENT ON COLUMN public.staff_credential_vault.password_ciphertext IS '서버 CREDENTIAL_VAULT_ENCRYPTION_KEY 로 암호화된 비밀번호';

CREATE TABLE IF NOT EXISTS public.staff_credential_vault_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.staff_credential_vault(id) ON DELETE CASCADE,
  accessor_email text NOT NULL,
  accessor_name text,
  accessor_position text,
  action text NOT NULL
    CHECK (action IN ('reveal_password', 'copy_password', 'create', 'update', 'delete', 'archive', 'restore')),
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_staff_credential_vault_access_logs_credential
  ON public.staff_credential_vault_access_logs (credential_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_credential_vault_access_logs_accessor
  ON public.staff_credential_vault_access_logs (lower(accessor_email), accessed_at DESC);

COMMENT ON TABLE public.staff_credential_vault_access_logs IS '자격 증명 금고 열람·변경 감사 로그';

CREATE OR REPLACE FUNCTION public.staff_credential_vault_can_access(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.staff_site_alert_can_send(p_email);
$$;

COMMENT ON FUNCTION public.staff_credential_vault_can_access(text) IS
  '자격 증명 금고 접근: OP / Office Manager / Super (staff_site_alert_can_send 와 동일)';

CREATE OR REPLACE FUNCTION public.staff_credential_vault_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_credential_vault_updated_at ON public.staff_credential_vault;
CREATE TRIGGER staff_credential_vault_updated_at
  BEFORE UPDATE ON public.staff_credential_vault
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_credential_vault_touch_updated_at();

ALTER TABLE public.staff_credential_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_credential_vault_access_logs ENABLE ROW LEVEL SECURITY;

-- 금고 본문: 클라이언트 직접 접근 차단 (API service role 전용)
DROP POLICY IF EXISTS "staff_credential_vault_deny_all" ON public.staff_credential_vault;
CREATE POLICY "staff_credential_vault_deny_all" ON public.staff_credential_vault
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 감사 로그: 권한 있는 직원만 조회 (삽입은 API service role)
DROP POLICY IF EXISTS "staff_credential_vault_access_logs_select" ON public.staff_credential_vault_access_logs;
CREATE POLICY "staff_credential_vault_access_logs_select" ON public.staff_credential_vault_access_logs
  FOR SELECT TO authenticated
  USING (public.staff_credential_vault_can_access(coalesce(auth.jwt() ->> 'email', '')));

COMMIT;
