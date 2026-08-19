-- Allow tour photo uploads of regular and slow-motion videos, plus common mobile image types.
-- Also raise the per-file cap so short 4K / slo-mo clips are not rejected.

UPDATE storage.buckets
SET
  file_size_limit = 524288000,
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
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
    'video/3gpp',
    'video/3gpp2',
    'video/mpeg',
    'video/x-msvideo',
    'video/hevc',
    'video/H264'
  ]::text[]
WHERE id = 'tour-photos';
