-- 렌터카 계약서·영수증 파일용 Storage 버킷
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-rental-files',
  'vehicle-rental-files',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vehicle-rental-files-public-read" ON storage.objects
FOR SELECT USING (bucket_id = 'vehicle-rental-files');

CREATE POLICY "vehicle-rental-files-authenticated-upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'vehicle-rental-files' AND auth.role() = 'authenticated');

CREATE POLICY "vehicle-rental-files-authenticated-update" ON storage.objects
FOR UPDATE USING (bucket_id = 'vehicle-rental-files' AND auth.role() = 'authenticated');

CREATE POLICY "vehicle-rental-files-authenticated-delete" ON storage.objects
FOR DELETE USING (bucket_id = 'vehicle-rental-files' AND auth.role() = 'authenticated');

COMMIT;
