-- 투어 사진용 storage 버킷 생성
-- Supabase 대시보드의 SQL Editor에서 실행하세요

BEGIN;

-- 1. tour-photos 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true, -- Public bucket으로 설정 (RLS 비활성화와 함께 사용)
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 2. 기존 storage 정책들 삭제 (혹시 있다면)
DROP POLICY IF EXISTS "Guides can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access for shared photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tour photos" ON storage.objects;

COMMIT;

-- 확인 쿼리
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = 'tour-photos';
