-- RLS 정책 재설정 (기존 정책 삭제 후 재생성)
-- 문서 테이블 정책 삭제
DROP POLICY IF EXISTS "Admins can access all documents" ON documents;
DROP POLICY IF EXISTS "Users can access their own documents" ON documents;

-- 카테고리 테이블 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can view categories" ON document_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON document_categories;

-- 권한 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view their permissions" ON document_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON document_permissions;

-- 알림 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view their reminders" ON document_reminders;

-- 다운로드 로그 테이블 정책 삭제
DROP POLICY IF EXISTS "Users can view their download logs" ON document_download_logs;
DROP POLICY IF EXISTS "Admins can view all download logs" ON document_download_logs;

-- Storage 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- 문서 테이블 정책 재생성
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

-- 카테고리 테이블 정책 재생성
CREATE POLICY "Authenticated users can view categories" ON document_categories
  FOR SELECT USING (auth.role() = 'authenticated');

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

-- 권한 테이블 정책 재생성
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

-- 알림 테이블 정책 재생성
CREATE POLICY "Users can view their reminders" ON document_reminders
  FOR SELECT USING (
    sent_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_reminders.document_id
      AND d.created_by = auth.uid()
    )
  );

-- 다운로드 로그 테이블 정책 재생성
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

-- Storage 정책 재생성
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM documents d
        WHERE d.file_path = name
        AND (
          d.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM document_permissions dp
            WHERE dp.document_id = d.id
            AND dp.user_id = auth.uid()
            AND dp.permission_type IN ('view', 'edit', 'delete')
          )
        )
      )
    )
  );

CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
