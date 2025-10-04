-- 투어별 개별 bucket들을 삭제하고 폴더 구조로 변경

-- 1단계: 투어별 bucket들 조회 (삭제 전 확인)
SELECT 
  id as bucket_name,
  name,
  public,
  created_at,
  (SELECT COUNT(*) FROM storage.objects o WHERE o.bucket_id = b.id) as file_count
FROM storage.buckets b
WHERE b.id LIKE 'tour-photos-%'
ORDER BY created_at;

-- 2단계: 각 bucket에 파일이 있는지 확인
DO $$
DECLARE
  bucket_record RECORD;
BEGIN
  RAISE NOTICE '=== 투어별 Bucket 파일 확인 ===';
  
  FOR bucket_record IN 
    SELECT id FROM storage.buckets WHERE id LIKE 'tour-photos-%'
  LOOP
    DECLARE
      file_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO file_count 
      FROM storage.objects 
      WHERE bucket_id = bucket_record.id;
      
      RAISE NOTICE 'Bucket: % - Files: %', bucket_record.id, file_count;
    END;
  END LOOP;
END $$;

-- 3단계: 보존할 파일이 있는 bucket들 확인
SELECT 
  b.id as bucket_name,
  COUNT(o.id) as file_count,
  array_agg(o.name ORDER BY o.created_at DESC) as file_names
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id = b.id
WHERE b.id LIKE 'tour-photos-%'
GROUP BY b.id, b.created_at
HAVING COUNT(o.id) > 0
ORDER BY COUNT(o.id) DESC;

-- 4단계: 모든 투어별 bucket과 정책 삭제
DO $$
DECLARE
  bucket_record RECORD;
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== 투어별 Bucket 정리 시작 ===';
  
  -- 먼저 관련 정책들 삭제
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname LIKE '%tour-photos-%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
  
  -- bucket들 삭제
  FOR bucket_record IN 
    SELECT id FROM storage.buckets WHERE id LIKE 'tour-photos-%'
  LOOP
    -- 먼저 bucket 내 파일들 삭제
    DELETE FROM storage.objects WHERE bucket_id = bucket_record.id;
    
    -- bucket 삭제
    DELETE FROM storage.buckets WHERE id = bucket_record.id;
    
    RAISE NOTICE 'Deleted bucket and files: %', bucket_record.id;
  END LOOP;
  
  RAISE NOTICE '=== 투어별 Bucket 정리 완료 ===';
END $$;

-- 5단계: 정리 후 확인
SELECT 
  'Cleanup completed! Total remaining buckets:' as status,
  COUNT(*) as bucket_count
FROM storage.buckets 
WHERE id LIKE 'tour-photos-%';
