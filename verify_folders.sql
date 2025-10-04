-- 폴더 생성 확인 및 실제 상태 점검

-- 1단계: 현재 storage.objects에 있는 모든 파일 확인
SELECT 
  'Current Storage Contents' as info,
  bucket_id,
  name as file_path,
  CASE 
    WHEN position('/' in name) > 0 THEN LEFT(name, position('/' in name) - 1)
    ELSE 'root'
  END as folder_name,
  (metadata->>'size')::bigint as file_size,
  created_at
FROM storage.objects 
WHERE bucket_id = 'tour-photos'
ORDER BY created_at DESC;

-- 2단계: 투어별 폴더 상태 상세 확인
WITH tour_folder_check AS (
  SELECT 
    t.id as tour_id,
    t.tour_date,
    t.product_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM storage.objects o 
        WHERE o.bucket_id = 'tour-photos' 
        AND o.name LIKE t.id || '/%'
      ) THEN '📁 Has files'
      ELSE '❌ No folder'
    END as folder_status,
    (
      SELECT COUNT(*) 
      FROM storage.objects o 
      WHERE o.bucket_id = 'tour-photos' 
      AND o.name LIKE t.id || '/%'
    ) as file_count
  FROM tours t
  WHERE t.tour_date >= CURRENT_DATE
  ORDER BY t.tour_date ASC
)
SELECT 
  tour_id,
  tour_date,
  product_id,
  folder_status,
  file_count
FROM tour_folder_check;

-- 3단계: 실제 폴더 생성 (더 확실한 방법)
DO $$
DECLARE
  tour_record RECORD;
  success_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== 실제 폴더 생성 시작 ===';
  
  FOR tour_record IN 
    SELECT id, tour_date, product_id
    FROM tours 
    WHERE tour_date >= CURRENT_DATE
    ORDER BY tour_date ASC
    LIMIT 10 -- 테스트용으로 10개만
  LOOP
    -- 마커 파일로 폴더 생성
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
      'tour-photos',
      tour_record.id || '/.folder_placeholder',
      auth.uid(),
      '{"size": 10, "mimetype": "text/plain"}'::jsonb
    )
    ON CONFLICT (bucket_id, name) DO NOTHING; -- 중복 방지
    
    success_count := success_count + 1;
    RAISE NOTICE 'Created folder marker: %', tour_record.id || '/.folder_placeholder';
  END LOOP;
  
  RAISE NOTICE '=== 폴더 생성 완료: %개 ===', success_count;
END $$;

-- 4단계: 생성 후 다시 확인
SELECT 
  'After Folder Creation' as status,
  COUNT(*) as total_files,
  COUNT(DISTINCT LEFT(name, position('/' in name) - 1)) as unique_folders
FROM storage.objects 
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/%';

-- 5단계: 폴더별 파일 목록
SELECT 
  LEFT(name, position('/' in name) - 1) as tour_folder,
  COUNT(*) as file_count,
  array_agg(name ORDER BY created_at) as files_in_folder
FROM storage.objects 
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/%'
GROUP BY LEFT(name, position('/' in name) - 1)
ORDER BY LEFT(name, position('/' in name) - 1);
