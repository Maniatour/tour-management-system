-- 오늘 이후의 모든 투어에 대해 사진 bucket 일괄 생성
-- 투어별 bucket: tour-photos-[tour_id]

-- 1단계: 투어별 bucket 생성 함수
CREATE OR REPLACE FUNCTION create_tour_photo_bucket(tour_id_param text)
RETURNS boolean AS $$
DECLARE
  bucket_name text;
  bucket_exists boolean := false;
BEGIN
  -- bucket 이름 생성
  bucket_name := 'tour-photos-' || tour_id_param;
  
  -- 기존 bucket이 있는지 확인
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = bucket_name
  ) INTO bucket_exists;
  
  -- 이미 존재하면 생성하지 않음
  IF bucket_exists THEN
    RAISE NOTICE 'Bucket % already exists, skipping...', bucket_name;
    RETURN true;
  END IF;
  
  -- bucket 생성
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    bucket_name,
    bucket_name,
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  );
  
  -- 정책 생성
  EXECUTE format('CREATE POLICY "Allow authenticated users to manage %s" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = %L)
    WITH CHECK (bucket_id = %L)', bucket_name, bucket_name, bucket_name);
    
  EXECUTE format('CREATE POLICY "Allow public to read %s" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = %L)', bucket_name, bucket_name);
  
  RAISE NOTICE 'Successfully created bucket: %', bucket_name;
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating bucket %: %', bucket_name, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 2단계: 오늘 이후의 투어들 조회 및 bucket 생성
DO $$
DECLARE
  tour_record RECORD;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- 오늘 날짜 이후의 투어들 조회
  FOR tour_record IN 
    SELECT id, tour_date 
    FROM tours 
    WHERE tour_date >= CURRENT_DATE 
    ORDER BY tour_date ASC
  LOOP
    -- bucket 생성 시도
    IF create_tour_photo_bucket(tour_record.id) THEN
      success_count := success_count + 1;
    ELSE
      error_count := error_count + 1;
    END IF;
  END LOOP;
  
  -- 결과 출력
  RAISE NOTICE '=== Bucket 생성 완료 ===';
  RAISE NOTICE '성공: %개', success_count;
  RAISE NOTICE '실패: %개', error_count;
END $$;

-- 3단계: 생성된 bucket 목록 확인
SELECT 
  b.id as bucket_name,
  b.name,
  b.public,
  b.file_size_limit,
  t.tour_date,
  t.product_id
FROM storage.buckets b
LEFT JOIN tours t ON b.id = 'tour-photos-' || t.id
WHERE b.id LIKE 'tour-photos-%'
ORDER BY 
  CASE WHEN t.tour_date IS NOT NULL THEN t.tour_date ELSE '9999-12-31' END,
  b.created_at;
