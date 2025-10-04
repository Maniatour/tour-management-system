-- 간단한 폴더 구조 확인 스크립트 (함수 없이 직접 쿼리)

-- 1단계: tour-photos bucket 상태 확인
SELECT 
  'tour-photos bucket status' as info,
  id as bucket_name,
  public,
  file_size_limit / 1024 / 1024 as size_limit_mb,
  created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 2단계: 폴더별 사진 파일 목록 조회 (간단 버전)
WITH folder_stats AS (
  SELECT 
    CASE 
      WHEN position('/' in name) > 0 THEN 
        LEFT(name, position('/' in name) - 1)
      ELSE 'root'
    END as folder_name,
    COUNT(*) as file_count,
    SUM((metadata->>'size')::bigint) as total_size_bytes,
    MIN(created_at) as first_upload,
    MAX(created_at) as last_upload
  FROM storage.objects 
  WHERE bucket_id = 'tour-photos'
  GROUP BY folder_name
  ORDER BY file_count DESC
)
SELECT 
  folder_name as tour_folder,
  file_count,
  ROUND(total_size_bytes::numeric / 1024.0 / 1024.0, 2) as total_size_mb,
  first_upload,
  last_upload
FROM folder_stats;

-- 3단계: 최근 업로드된 파일들
SELECT 
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  ROUND(((metadata->>'size')::bigint) / 1024.0, 2) as file_size_kb,
  created_at as upload_time,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM storage.objects 
WHERE bucket_id = 'tour-photos'
ORDER BY created_at DESC 
LIMIT 20;

-- 4단계: 전체 Storage 사용률 요약
SELECT 
  'Storage Usage Summary' as summary,
  COUNT(DISTINCT CASE 
    WHEN position('/' in name) > 0 THEN 
      LEFT(name, position('/' in name) - 1)
    ELSE 'root'
  END) as active_tour_folders,
  COUNT(*) as total_files,
  SUM((metadata->>'size')::bigint) as total_size_bytes,
  ROUND(SUM((metadata->>'size')::bigint)::numeric / 1024.0 / 1024.0, 2) as total_size_mb,
  ROUND(AVG((metadata->>'size')::bigint)::numeric / 1024.0, 2) as avg_file_size_kb
FROM storage.objects 
WHERE bucket_id = 'tour-photos';

-- 5단계: Storage 정책 확인
SELECT 
  'Storage Policies' as info,
  policyname,
  cmd as command,
  array_to_string(roles, ', ') as roles,
  CASE 
    WHEN permissive THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as policy_type
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%tour-photos%';

-- 성공 메시지
SELECT 'Folder structure check completed!' as status;
