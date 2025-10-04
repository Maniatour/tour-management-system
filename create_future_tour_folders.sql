-- 오늘 이후의 모든 투어에 대해 tour-photos bucket 아래 폴더 생성

-- 1단계: 미래 투어 조회 및 확인
SELECT 
  'Future Tours Analysis' as info,
  COUNT(*) as total_future_tours,
  MIN(tour_date) as earliest_tour,
  MAX(tour_date) as latest_tour,
  COUNT(DISTINCT product_id) as unique_products
FROM tours 
WHERE tour_date >= CURRENT_DATE;

-- 2단계: 투어별 정보와 기존 폴더 상태 확인
WITH tour_analysis AS (
  SELECT 
    t.id as tour_id,
    t.tour_date,
    t.product_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM storage.objects o 
        WHERE o.bucket_id = 'tour-photos' 
        AND o.name LIKE t.id || '/%'
      ) THEN '✅ Folder exists'
      ELSE '❌ Folder missing'
    END as folder_status
  FROM tours t
  WHERE t.tour_date >= CURRENT_DATE
  ORDER BY t.tour_date ASC
)
SELECT 
  tour_id,
  tour_date,
  product_id,
  folder_status
FROM tour_analysis;

-- 3단계: 폴더 생성 함수 (빈 파일로 폴더 생성)
CREATE OR REPLACE FUNCTION create_tour_folder(tour_id_param text)
RETURNS boolean AS $$
DECLARE
  folder_path text;
BEGIN
  folder_path := tour_id_param || '/.folder_created';
  
  -- 폴더가 이미 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'tour-photos' 
    AND name LIKE tour_id_param || '/%'
  ) THEN
    RAISE NOTICE 'Folder for tour % already exists', tour_id_param;
    RETURN true;
  END IF;
  
  -- 폴더 생성기를 위한 마커 파일 생성
  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('tour-photos', folder_path, auth.uid());
  
  RAISE NOTICE 'Created folder for tour: %', tour_id_param;
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating folder for tour %: %', tour_id_param, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4단계: 미래 투어 폴더 일괄 생성
DO $$
DECLARE
  tour_record RECORD;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
  folder_exists_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== 미래 투어 폴더 생성 시작 ===';
  
  FOR tour_record IN 
    SELECT id, tour_date, product_id
    FROM tours 
    WHERE tour_date >= CURRENT_DATE
    ORDER BY tour_date ASC
  LOOP
    -- 폴더 생성 시도
    IF create_tour_folder(tour_record.id) THEN
      success_count := success_count + 1;
      RAISE NOTICE '✅ 폴더 생성 성공: % (%s)', tour_record.id, tour_record.tour_date;
    ELSE
      error_count := error_count + 1;
      RAISE NOTICE '❌ 폴더 생성 실패: % (%s)', tour_record.id, tour_record.tour_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== 미래 투어 폴더 생성 완료 ===';
  RAISE NOTICE '성공: %개', success_count;
  RAISE NOTICE '실패: %개', error_count;
END $$;

-- 5단계: 생성 결과 확인
WITH folder_results AS (
  SELECT 
    LEFT(name, position('/' in name) - 1) as tour_folder,
    COUNT(*) as file_count,
    MIN(created_at) as folder_created_at
  FROM storage.objects 
  WHERE bucket_id = 'tour-photos' 
  AND name LIKE '%/.folder_created'
  GROUP BY LEFT(name, position('/' in name) - 1)
)
SELECT 
  fr.tour_folder,
  t.tour_date,
  t.product_id,
  fr.file_count,
  fr.folder_created_at,
  CASE 
    WHEN fr.file_count > 1 THEN '📁 Folder has photos'
    ELSE '📁 Empty folder'
  END as folder_status
FROM folder_results fr
LEFT JOIN tours t ON t.id = fr.tour_folder
WHERE t.tour_date >= CURRENT_DATE
ORDER BY t.tour_date ASC;

-- 6단계: 마커 파일 정리 (선택사항 - 폴더 확인용으로 유지 가능)
DO $$
BEGIN
  -- .folder_created 마커 파일들 삭제 (폴더만 남기고)
  DELETE FROM storage.objects 
  WHERE bucket_id = 'tour-photos' 
  AND name LIKE '%/.folder_created';
  
  RAISE NOTICE 'Cleaned up folder marker files';
END $$;

-- 7단계: 최종 확인 - 생성된 폴더 목록
SELECT 
  'Final Folder Summary' as summary,
  COUNT(DISTINCT LEFT(name, position('/' in name) - 1)) as total_folders,
  COUNT(*) as total_files,
  MIN(tour_date) as earliest_tour,
  MAX(tour_date) as latest_tour
FROM storage.objects so
LEFT JOIN tours t ON t.id = LEFT(name, position('/' in name) - 1)
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/%'
AND t.tour_date >= CURRENT_DATE;

-- 성공 메시지
SELECT 'Future tour folders created successfully!' as status;
