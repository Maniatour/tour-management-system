-- Storage 버킷 파일 크기 제한 업데이트
-- 가이드가 큰 사진들을 업로드할 수 있도록 제한을 늘립니다

BEGIN;

-- 1. tour-photos 버킷의 파일 크기 제한을 50MB로 증가
UPDATE storage.buckets 
SET file_size_limit = 52428800  -- 50MB (50 * 1024 * 1024)
WHERE id = 'tour-photos';

-- 2. 허용된 MIME 타입에 더 많은 이미지 형식 추가
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/webp', 
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif'
]
WHERE id = 'tour-photos';

COMMIT;

-- 확인 쿼리
SELECT 
  id, 
  name, 
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'tour-photos';
