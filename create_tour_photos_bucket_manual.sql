-- 투어 포토 버켓 수동 생성 SQL
-- Supabase SQL Editor에서 실행하세요

-- 1. tour-photos 버켓 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true, -- Public bucket for easier access
  52428800, -- 50MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 2. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;

-- 3. 새로운 정책 생성
CREATE POLICY "Allow authenticated users to upload tour photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to view tour photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to update tour photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'tour-photos');

CREATE POLICY "Allow authenticated users to delete tour photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'tour-photos');

-- 4. 공개 접근 허용 (사진 공유용)
CREATE POLICY "Allow public access to tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- 5. 확인 쿼리
SELECT 'tour-photos bucket created successfully' as status;
SELECT * FROM storage.buckets WHERE id = 'tour-photos';
