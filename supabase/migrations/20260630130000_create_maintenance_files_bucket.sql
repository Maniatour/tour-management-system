-- 차량 정비 파일용 Storage 버킷 (202501200004에서 INSERT가 주석 처리되어 누락됨)
begin;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-files',
  'maintenance-files',
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

commit;
