-- RLS 일시적 비활성화 및 tour-photos 버켓 생성
-- 이 SQL을 Supabase SQL Editor에서 실행하세요

BEGIN;

-- 1. Storage RLS 일시적 비활성화
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 2. tour-photos 버켓 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- 3. RLS 다시 활성화
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. 필요한 정책만 생성
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

CREATE POLICY "Allow public access to tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

COMMIT;

-- 확인
SELECT 'tour-photos bucket created with RLS policies' as status;
