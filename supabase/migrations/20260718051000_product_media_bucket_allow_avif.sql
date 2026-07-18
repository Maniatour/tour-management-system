-- product-media: allow AVIF uploads
-- Existing bucket allows jpeg/png/gif/webp + video/pdf/doc, but not image/avif.
-- Browsers and Next.js image pipeline commonly produce AVIF; uploads failed with:
-- StorageApiError: mime type image/avif is not supported

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
WHERE id = 'product-media';
