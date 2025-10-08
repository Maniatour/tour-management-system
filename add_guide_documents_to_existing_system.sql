-- 기존 문서 관리 시스템에 가이드 문서 카테고리 추가
-- 가이드 개인 문서 관리를 위한 카테고리 생성

-- 1. 가이드 문서 카테고리 추가 (중복 체크 없이)
INSERT INTO document_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) 
SELECT '가이드 자격증', 'Guide Certificates', '가이드 개인 자격증 및 인증서', 'Personal certificates and licenses for guides', '#10B981', 'shield', 100
WHERE NOT EXISTS (SELECT 1 FROM document_categories WHERE name_ko = '가이드 자격증');

INSERT INTO document_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) 
SELECT '메디컬 리포트', 'Medical Reports', '가이드 의료 검진 보고서', 'Medical examination reports for guides', '#EF4444', 'heart', 101
WHERE NOT EXISTS (SELECT 1 FROM document_categories WHERE name_ko = '메디컬 리포트');

INSERT INTO document_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) 
SELECT 'CPR 자격증', 'CPR Certificates', '가이드 CPR 자격증', 'CPR certificates for guides', '#F59E0B', 'activity', 102
WHERE NOT EXISTS (SELECT 1 FROM document_categories WHERE name_ko = 'CPR 자격증');

-- 2. 기존 documents 테이블에 가이드 이메일 컬럼 추가 (이미 있다면 무시)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'guide_email'
    ) THEN
        ALTER TABLE documents ADD COLUMN guide_email VARCHAR(255);
        COMMENT ON COLUMN documents.guide_email IS '가이드 이메일 (가이드 개인 문서인 경우)';
    END IF;
END $$;

-- 3. 가이드 이메일 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_documents_guide_email ON documents(guide_email);

-- 4. 가이드 문서 접근 권한 정책 추가
-- 가이드는 자신의 문서만 볼 수 있음
CREATE POLICY "Guides can view their own documents" ON documents
  FOR SELECT USING (
    guide_email IS NOT NULL 
    AND guide_email = auth.email()
  );

-- 가이드는 자신의 문서만 삽입할 수 있음
CREATE POLICY "Guides can insert their own documents" ON documents
  FOR INSERT WITH CHECK (
    guide_email IS NOT NULL 
    AND guide_email = auth.email()
  );

-- 가이드는 자신의 문서만 업데이트할 수 있음
CREATE POLICY "Guides can update their own documents" ON documents
  FOR UPDATE USING (
    guide_email IS NOT NULL 
    AND guide_email = auth.email()
  );

-- 가이드는 자신의 문서만 삭제할 수 있음
CREATE POLICY "Guides can delete their own documents" ON documents
  FOR DELETE USING (
    guide_email IS NOT NULL 
    AND guide_email = auth.email()
  );

-- 관리자, 매니저는 모든 가이드 문서를 볼 수 있음
CREATE POLICY "Admins and managers can view all guide documents" ON documents
  FOR SELECT USING (
    guide_email IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 관리자, 매니저는 모든 가이드 문서를 관리할 수 있음
CREATE POLICY "Admins and managers can manage all guide documents" ON documents
  FOR ALL USING (
    guide_email IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 5. 가이드 문서용 스토리지 정책 추가
-- 가이드 문서 폴더에 대한 스토리지 정책
CREATE POLICY "Guides can upload their documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND auth.email() IS NOT NULL
  );

CREATE POLICY "Guides can view their documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
  );

CREATE POLICY "Guides can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND auth.email() IS NOT NULL
  );

-- 관리자, 매니저는 모든 가이드 문서를 관리할 수 있음
CREATE POLICY "Admins and managers can manage all guide documents storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );
