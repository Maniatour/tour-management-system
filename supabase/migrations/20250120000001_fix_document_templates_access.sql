-- document_templates 테이블 RLS 비활성화 및 권한 부여
ALTER TABLE public.document_templates DISABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근할 수 있도록 권한 부여
GRANT ALL ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO anon;
GRANT ALL ON public.document_templates TO service_role;

-- 테이블 존재 확인
SELECT 'document_templates 테이블이 존재합니다' as status 
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'document_templates' 
  AND table_schema = 'public'
);
