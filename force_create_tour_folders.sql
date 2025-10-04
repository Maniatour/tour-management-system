-- 강력한 투어 폴더 생성을 위한 스크립트

-- 실제로 보이는 폴더를 생성하기 위해 마커 파일을 남겨둠

-- 1단계: 기존 마커 파일들 정리
DELETE FROM storage.objects 
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/.folder%';

-- 2단계: 각 투어의 폴더 생성 (마커 파일 포함)
DO $$
DECLARE
  tour_record RECORD;
  success_count INTEGER := 0;
  folder_name TEXT;
BEGIN
  RAISE NOTICE '=== 강력한 폴더 생성 시작 ===';
  
  FOR tour_record IN 
    SELECT id, tour_date, product_id
    FROM tours 
    -- WHERE tour_date >= CURRENT_DATE
    WHERE EXTRACT(YEAR FROM tour_date) >= EXTRACT(YEAR FROM CURRENT_DATE) -- 올해 모든 투어
    ORDER BY tour_date ASC
  LOOP
    folder_name := tour_record.id || '/folder.info';
    
    -- 폴더가 이미 존재하는지 확인
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects 
      WHERE bucket_id = 'tour-photos' 
      AND name LIKE tour_record.id || '/%'
    ) THEN
      -- 마커 파일 생성 (영구 보존)
      INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES (
        'tour-photos',
        folder_name,
        auth.uid(),
        json_build_object(
          'size', 58,
          'mimetype', 'text/plain',
          'created_for_tour', tour_record.id,
          'tour_date', tour_record.tour_date::text,
          'is_folder_marker', true
        )::jsonb
      );
      
      success_count := success_count + 1;
      RAISE NOTICE '📁 폴더 생성: % (%s)', tour_record.id, tour_record.tour_date;
    ELSE
      RAISE NOTICE '✅ 폴더 존재: % (%s)', tour_record.id, tour_record.tour_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== 폴더 생성 완료: %개 새로 생성 ===', success_count;
END $$;

-- 3단계: 생성된 폴더들 확인
WITH folder_summary AS (
  SELECT 
    LEFT(name, position('/' in name) - 1) as tour_folder,
    COUNT(*) as file_count,
    MIN(created_at) as folder_created_at,
    MAX(CASE WHEN metadata->>'is_folder_marker' = 'true' THEN 'YES' ELSE 'NO' END) as has_marker
  FROM storage.objects 
  WHERE bucket_id = 'tour-photos' 
  AND name LIKE '%/%'
  GROUP BY LEFT(name, position('/' in name) - 1)
)
SELECT 
  fs.tour_folder,
  t.tour_date,
  t.product_id,
  fs.file_count,
  fs.has_marker,
  fs.folder_created_at,
  CASE 
    WHEN fs.file_count = 1 AND fs.has_marker = 'YES' THEN '📁 빈 폴더 (마커만)'
    WHEN fs.file_count > 1 THEN '📁 사진 포함 폴더'
    ELSE '❓ 이상한 상태'
  END as folder_status
FROM folder_summary fs
LEFT JOIN tours t ON t.id = fs.tour_folder
ORDER BY t.tour_date ASC;

-- 4단계: 전체 통계
SELECT 
  'Overall Folder Statistics' as summary,
  COUNT(DISTINCT LEFT(name, position('/' in name) - 1)) as total_tour_folders,
  COUNT(*) as total_files,
  COUNT(CASE WHEN metadata->>'is_folder_marker' = 'true' THEN 1 END) as marker_files,
  COUNT(CASE WHEN metadata->>'is_folder_marker' != 'true' THEN 1 END) as photo_files
FROM storage.objects 
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/%';

-- 5단계: 투어별 업로드 테스트용 안내 파일 생성
DO $$
DECLARE
  tour_record RECORD;
BEGIN
  RAISE NOTICE '=== 업로드 가이드 파일 생성 ===';
  
  FOR tour_record IN 
    SELECT id FROM tours 
    WHERE EXTRACT(YEAR FROM tour_date) >= EXTRACT(YEAR FROM CURRENT_DATE)
    ORDER BY tour_date ASC
    LIMIT 5 -- 처음 5개만 예시용
  LOOP
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
      'tour-photos',
      tour_record.id || '/README.txt',
      auth.uid(),
      json_build_object(
        'size', 156,
        'mimetype', 'text/plain',
        'is_readme', true
      )::jsonb
    )
    ON CONFLICT (bucket_id, name) DO NOTHING;
    
    RAISE NOTICE '가이드 파일 생성: %/README.txt', tour_record.id;
  END LOOP;
END $$;

-- 성공 메시지
SELECT 'Tour folders created with visible markers!' as status;
