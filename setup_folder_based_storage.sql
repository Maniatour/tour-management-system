-- 폴더 구조 기반 투어 사진 Storage 설정

-- 1단계: replace 함수로 bucket 생성
CREATE OR REPLACE FUNCTION create_tour_photos_bucket()
RETURNS boolean AS $$
DECLARE
  bucket_exists boolean := false;
BEGIN
  -- 기존 bucket 확인
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'tour-photos'
  ) INTO bucket_exists;
  
  IF bucket_exists THEN
    RAISE NOTICE 'tour-photos bucket already exists, updating settings...';
    
    -- 설정 업데이트
    UPDATE storage.buckets 
    SET 
      public = true,
      file_size_limit = 104857600, -- 100MB (더 큰 용량)
      allowed_mime_types = ARRAY[
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/webp', 
        'image/gif',
        'image/svg+xml'
      ]
    WHERE id = 'tour-photos';
    
  ELSE
    -- 새 bucket 생성
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'tour-photos',
      'tour-photos',
      true,
      104857600, -- 100MB
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    );
    
    RAISE NOTICE 'Created new tour-photos bucket';
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 2단계: bucket 생성 실행
SELECT create_tour_photos_bucket();

-- 3단계: Storage 정책 설정 (폴더별 접근 제어)
-- 기존 정책들 삭제
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;
DROP POLICY IF EXISTS "tour-photos_full_access" ON storage.objects;
DROP POLICY IF EXISTS "tour-photos_authenticated_full_access" ON storage.objects;
DROP POLICY IF EXISTS "tour-photos_anon_read" ON storage.objects;

-- 새로운 폴더 기반 정책 생성
-- 인증된 사용자는 tour-photos bucket의 모든 파일 관리 가능
CREATE POLICY "tour-photos-manage-files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'tour-photos')
WITH CHECK (bucket_id = 'tour-photos');

-- 익명 사용자는 tour-photos bucket의 모든 파일 조회 가능
CREATE POLICY "tour-photos-public-read" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- 4단계: 폴더별 구조 확인을 위한 함수
CREATE OR REPLACE FUNCTION get_tour_folders()
RETURNS TABLE (
  folder_path text,
  file_count bigint,
  total_size numeric,
  last_modified timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN position('/' in name) = 0 THEN '/'
      ELSE left(name, position('/' in name) - 1)
    END as folder_path,
    COUNT(*) as file_count,
    SUM((metadata->>'size')::bigint) as total_size,
    MAX(created_at) as last_modified
  FROM storage.objects
  WHERE bucket_id = 'tour-photos'
  GROUP BY 
    CASE 
      WHEN position('/' in name) = 0 THEN '/'
      ELSE left(name, position('/' in name) - 1)
    END
  ORDER BY folder_path;
END;
$$ LANGUAGE plpgsql;

-- 5단계: 폴더 구조 확인 함수 실행
SELECT * FROM get_tour_folders();

-- 6단계: bucket 상태 확인
SELECT 
  id as bucket_name,
  name,
  public,
  file_size_limit / 1024 / 1024 as file_size_limit_mb,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 7단계: 성공 메시지
SELECT 'Folder-based tour photos storage setup completed!' as status;
