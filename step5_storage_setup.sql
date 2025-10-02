-- 5단계: Storage 버킷 및 정책 설정
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-files',
  'document-files',
  false,
  104857600, -- 100MB 제한
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
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
