-- 사이트 구조 CRUD 매트릭스: 페르소나별 JSON 패치(키 read/write/update/delete)로 기본값을 덮어씀.
-- 실제 네비·표시는 앱에서 baseline과 병합.

CREATE TABLE IF NOT EXISTS public.site_access_matrix_overrides (
  node_id text NOT NULL,
  persona text NOT NULL,
  patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_access_matrix_overrides_persona_check CHECK (
    persona = ANY (
      ARRAY[
        'customer'::text,
        'guide'::text,
        'op'::text,
        'office_manager'::text,
        'super'::text
      ]
    )
  ),
  CONSTRAINT site_access_matrix_overrides_patch_object_check CHECK (jsonb_typeof(patch) = 'object'),
  PRIMARY KEY (node_id, persona)
);

COMMENT ON TABLE public.site_access_matrix_overrides IS 'admin-site-access-tree 노드 id + 페르소나별 CRUD 패치. 빈 {} = 상속.';

CREATE INDEX IF NOT EXISTS idx_site_access_matrix_overrides_updated
  ON public.site_access_matrix_overrides (updated_at DESC);

CREATE OR REPLACE FUNCTION public.can_edit_site_access_matrix()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT EXISTS (
        SELECT 1
        FROM public.team t
        WHERE lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          AND t.is_active = true
          AND (
            lower(trim(coalesce(t.position, ''))) IN ('super', 'office manager', '매니저')
            OR lower(trim(coalesce(auth.jwt() ->> 'email', ''))) IN (
              'info@maniatour.com',
              'wooyong.shim09@gmail.com'
            )
          )
      )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_site_access_matrix() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_site_access_matrix() TO authenticated;

ALTER TABLE public.site_access_matrix_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_access_matrix_overrides_select_team
  ON public.site_access_matrix_overrides
  FOR SELECT
  TO authenticated
  USING (
    public.can_edit_site_access_matrix()
    OR EXISTS (
      SELECT 1
      FROM public.team t
      WHERE lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        AND t.is_active = true
    )
  );

CREATE POLICY site_access_matrix_overrides_insert_editors
  ON public.site_access_matrix_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_site_access_matrix());

CREATE POLICY site_access_matrix_overrides_update_editors
  ON public.site_access_matrix_overrides
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_site_access_matrix())
  WITH CHECK (public.can_edit_site_access_matrix());

CREATE POLICY site_access_matrix_overrides_delete_editors
  ON public.site_access_matrix_overrides
  FOR DELETE
  TO authenticated
  USING (public.can_edit_site_access_matrix());
