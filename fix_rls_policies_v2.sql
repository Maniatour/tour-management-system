-- RLS 정책 수정 (auth.users 테이블 접근 문제 해결)

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins can access all documents" ON documents;
DROP POLICY IF EXISTS "Users can access their own documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON document_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON document_categories;
DROP POLICY IF EXISTS "Users can view their permissions" ON document_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON document_permissions;
DROP POLICY IF EXISTS "Users can view their reminders" ON document_reminders;
DROP POLICY IF EXISTS "Users can view their download logs" ON document_download_logs;
DROP POLICY IF EXISTS "Admins can view all download logs" ON document_download_logs;

-- 수정된 정책 생성 (auth.users 테이블 접근 없이)
CREATE POLICY "Admins can access all documents" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

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

CREATE POLICY "Authenticated users can view categories" ON document_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage categories" ON document_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can view their permissions" ON document_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage permissions" ON document_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can view their reminders" ON document_reminders
  FOR SELECT USING (
    sent_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_reminders.document_id
      AND d.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view their download logs" ON document_download_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all download logs" ON document_download_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );
