-- Supabase Storage 설정 및 이미지 업로드 기능 활성화
-- 이미지 업로드를 위한 Storage 버킷 생성 및 정책 설정

-- 1. Storage 버킷 생성 (이미 존재하는 경우 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880, -- 5MB 제한
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage 정책 생성 - 모든 사용자가 이미지 업로드 가능
CREATE POLICY IF NOT EXISTS "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images');

-- 3. Storage 정책 생성 - 모든 사용자가 이미지 읽기 가능
CREATE POLICY IF NOT EXISTS "Allow public access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

-- 4. Storage 정책 생성 - 모든 사용자가 이미지 삭제 가능
CREATE POLICY IF NOT EXISTS "Allow public deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'images');

-- 5. 이미지 업로드 통계를 위한 함수
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE(
  total_files BIGINT,
  total_size BIGINT,
  files_by_folder JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_files,
    SUM(COALESCE(metadata->>'size', '0')::BIGINT) as total_size,
    jsonb_object_agg(
      COALESCE((name_split[1]), 'root'),
      jsonb_build_object(
        'count', COUNT(*),
        'size', SUM(COALESCE(metadata->>'size', '0')::BIGINT)
      )
    ) as files_by_folder
  FROM storage.objects
  WHERE bucket_id = 'images'
  AND name ~ '^[^/]+/'
  CROSS JOIN LATERAL string_to_array(name, '/') AS name_split;
END;
$$ LANGUAGE plpgsql;

-- 6. 이미지 정리 함수 (사용하지 않는 이미지 삭제)
CREATE OR REPLACE FUNCTION cleanup_unused_images()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  image_record RECORD;
BEGIN
  -- options 테이블에서 사용되지 않는 이미지 찾기
  FOR image_record IN
    SELECT 
      so.name as file_path,
      so.id as file_id
    FROM storage.objects so
    WHERE so.bucket_id = 'images'
    AND NOT EXISTS (
      SELECT 1 FROM options 
      WHERE image_url LIKE '%' || so.name || '%'
      OR thumbnail_url LIKE '%' || so.name || '%'
    )
  LOOP
    -- 파일 삭제
    DELETE FROM storage.objects 
    WHERE id = image_record.file_id;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. 이미지 최적화 함수 (썸네일 자동 생성)
CREATE OR REPLACE FUNCTION generate_thumbnail_url(original_url TEXT)
RETURNS TEXT AS $$
BEGIN
  -- 실제 구현에서는 이미지 리사이징 서비스를 사용
  -- 현재는 원본 URL 반환 (나중에 Cloudinary, ImageKit 등으로 교체 가능)
  RETURN original_url;
END;
$$ LANGUAGE plpgsql;

-- 8. 이미지 업로드 트리거 (자동 썸네일 생성)
CREATE OR REPLACE FUNCTION auto_generate_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  -- 썸네일 URL이 없으면 자동 생성
  IF NEW.image_url IS NOT NULL AND NEW.thumbnail_url IS NULL THEN
    NEW.thumbnail_url := generate_thumbnail_url(NEW.image_url);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_thumbnail_trigger
  BEFORE INSERT OR UPDATE ON options
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_thumbnail();

-- 9. 이미지 관련 뷰 생성
CREATE OR REPLACE VIEW options_with_images AS
SELECT 
  o.*,
  CASE 
    WHEN o.image_url IS NOT NULL THEN true 
    ELSE false 
  END as has_image,
  CASE 
    WHEN o.thumbnail_url IS NOT NULL THEN o.thumbnail_url
    ELSE o.image_url
  END as display_image
FROM options o
ORDER BY o.category, o.sort_order, o.name;

-- 10. 이미지 통계 뷰
CREATE OR REPLACE VIEW image_statistics AS
SELECT 
  'options' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as records_with_images,
  COUNT(CASE WHEN image_url IS NULL THEN 1 END) as records_without_images,
  ROUND(
    COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as image_coverage_percentage
FROM options
UNION ALL
SELECT 
  'storage' as table_name,
  (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'images') as total_records,
  (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'images') as records_with_images,
  0 as records_without_images,
  100.0 as image_coverage_percentage;

-- 11. 완료 메시지
SELECT '이미지 업로드 기능이 성공적으로 설정되었습니다!' as message;
SELECT 'Storage 버킷: images' as bucket_info;
SELECT '지원 형식: JPEG, PNG, GIF, WebP' as supported_formats;
SELECT '최대 크기: 5MB' as max_size;
