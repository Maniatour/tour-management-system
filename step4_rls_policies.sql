-- 4단계: RLS 정책 설정
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_download_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 문서에 접근 가능
CREATE POLICY "Admins can access all documents" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 일반 사용자는 자신이 생성한 문서와 권한이 있는 문서에만 접근 가능
CREATE POLICY "Users can access their own documents" ON documents
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM document_permissions dp
      WHERE dp.document_id = documents.id
      AND dp.user_id = auth.uid()
      AND dp.permission_type IN ('view', 'edit', 'delete')
    )
  );

-- 카테고리는 모든 인증된 사용자가 조회 가능
CREATE POLICY "Authenticated users can view categories" ON document_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자는 카테고리 관리 가능
CREATE POLICY "Admins can manage categories" ON document_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 문서 권한 테이블 정책
CREATE POLICY "Users can view their permissions" ON document_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage permissions" ON document_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 문서 알림 로그 정책
CREATE POLICY "Users can view their reminders" ON document_reminders
  FOR SELECT USING (
    sent_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_reminders.document_id
      AND d.created_by = auth.uid()
    )
  );

-- 다운로드 로그 정책
CREATE POLICY "Users can view their download logs" ON document_download_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all download logs" ON document_download_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );
