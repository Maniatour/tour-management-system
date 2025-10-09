-- document_templates 테이블 RLS 비활성화
ALTER TABLE public.document_templates DISABLE ROW LEVEL SECURITY;

-- 또는 모든 사용자가 접근할 수 있도록 정책 생성
DROP POLICY IF EXISTS "document_templates_all_access" ON public.document_templates;
CREATE POLICY "document_templates_all_access" ON public.document_templates
  FOR ALL USING (true) WITH CHECK (true);

-- 테이블 권한 확인 및 부여
GRANT ALL ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO anon;
GRANT ALL ON public.document_templates TO service_role;
