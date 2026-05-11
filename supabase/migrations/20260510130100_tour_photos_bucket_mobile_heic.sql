-- 가이드 모바일: HEIC·대용량 사진이 Storage에서 거절되지 않도록 tour-photos 버킷 정책 정비
-- (기존 마이그레이션은 10MB·jpeg/png/webp/gif 만 허용)

UPDATE storage.buckets
SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/bmp',
    'image/tiff',
    'image/avif'
  ]::text[]
WHERE id = 'tour-photos';
