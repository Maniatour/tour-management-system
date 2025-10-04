-- 새 투어 생성 시 자동으로 폴더 생성하는 시스템

-- 1단계: 기존 트리거 정리 (투어별 bucket 생성용)
DROP TRIGGER IF EXISTS auto_create_bucket_on_tour_insert ON tours;
DROP FUNCTION IF EXISTS trigger_create_tour_bucket();
DROP FUNCTION IF EXISTS create_tour_photo_bucket(text);

-- 2단계: 폴더 생성 함수
CREATE OR REPLACE FUNCTION create_tour_folder_if_needed(tour_id_param text)
RETURNS boolean AS $$
BEGIN
  -- 마커 파일로 폴더 생성
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    'tour-photos',
    tour_id_param || '/.folder_created',
    auth.uid(),
    '{"size": 0, "mimetype": "text/plain"}'::jsonb
  );
  
  -- 생성 후 마커 파일 즉시 삭제
  DELETE FROM storage.objects 
  WHERE bucket_id = 'tour-photos' 
  AND name = tour_id_param || '/.folder_created';
  
  RAISE NOTICE 'Created folder structure for tour: %', tour_id_param;
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating folder for tour %: %', tour_id_param, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3단계: 투어 INSERT 시 폴더 생성 트리거 함수
CREATE OR REPLACE FUNCTION trigger_create_tour_folder()
RETURNS TRIGGER AS $$
BEGIN
  -- 새 투어에 대해 폴더 생성 시도
  PERFORM create_tour_folder_if_needed(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4단계: 투어 INSERT 트리거 설정
CREATE TRIGGER auto_create_folder_on_tour_insert
  AFTER INSERT ON tours
  FOR EACH ROW
  WHEN (NEW.tour_date >= CURRENT_DATE) -- 미래 투어만
  EXECUTE FUNCTION trigger_create_tour_folder();

-- 5단계: 미래 투어들에 대한 폴더 생성 (미리 생성)
DO $$
DECLARE
  tour_record RECORD;
  success_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== 미래 투어 폴더 사전 생성 시작 ===';
  
  FOR tour_record IN 
    SELECT id, tour_date
    FROM tours 
    WHERE tour_date >= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM storage.objects 
      WHERE bucket_id = 'tour-photos' 
      AND name LIKE tour_record.id || '/%'
    )
    ORDER BY tour_date ASC
  LOOP
    IF create_tour_folder_if_needed(tour_record.id) THEN
      success_count := success_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== 미래스 투어 폴더 사전 생성 완료: %개 생성 ===', success_count;
END $$;

-- 6단계: 생성된 폴더 확인
SELECT 
  'tour-photos 폴더 구조 확인' as status,
  COUNT(DISTINCT LEFT(name, position('/' in name) > 0 ? position('/' in name) - 1 : 0)) as total_folders,
  COUNT(*) as total_files
FROM storage.objects 
WHERE bucket_id = 'tour-photos' 
AND name LIKE '%/%';

-- 7단계: 트리거 상태 확인
SELECT 
  'Auto folder creation trigger installed!' as status,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'auto_create_folder_on_tour_insert';

-- 성공 메시지
SELECT 'Tour folder auto-creation system ready!' as final_status;
