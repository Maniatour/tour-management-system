-- Supabase Storage: tour-photos bucket 간단 설정 (기본 버전)

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Team-based select tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Team-based insert tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Team-based update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin-only delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read tour photos" ON storage.objects;

-- 2. 기존 bucket 삭제
DELETE FROM storage.buckets WHERE id = 'tour-photos';

-- 3. 새로운 bucket 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'track-photos',
    'track-photos',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'avatar/*']
) ON CONFLICT (id) DO NOTHING;

-- 4. 간단한 정책 설정

-- 모든 인증된 사용자가 업로드 가능
CREATE POLICY "Anyone can upload tour photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'track-photos');

-- 모든 인증된 사용자가 읽기 가능
CREATE POLICY "Anyone can view tour photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'track-photos');

-- 모든 인증된 사용자가 수정 가능
CREATE POLICY "Anyone can update tour photos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'track-photos');

-- 모든 인증된 사용자가 삭제 가능
CREATE POLICY "Anyone can delete tour photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'track-photos');

-- 익명 사용자도 읽기 가능 (Public access)
CREATE POLICY "Anonymous can view tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'track-photos');

-- 확인
SELECT 'Simple tour-photos bucket created successfully' as message;
