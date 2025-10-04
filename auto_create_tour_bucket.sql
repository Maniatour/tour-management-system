-- 새 투어 생성 시 자동으로 사진 bucket 생성하는 시스템

-- 1단계: 자동 bucket 생성 함수 (기존 함수와 동일)
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

-- 2단계: 트리거 함수 생성 (INSERT/UPDATE 시 호출)
CREATE OR REPLACE FUNCTION trigger_create_tour_bucket()
RETURNS TRIGGER AS $$
DECLARE
  bucket_name text;
BEGIN
  -- 새 레코드에 대해 bucket 생성
  IF TG_OP = 'INSERT' THEN
    bucket_name := 'tour-photos-' || NEW.id;
    
    -- bucket 생성 시도 (존재하지 않는 경우에만)
    PERFORM create_tour_photo_bucket(NEW.id);
    
    RAISE NOTICE 'Auto-created bucket for tour: % (bucket: %)', NEW.id, bucket_name;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3단계: 트리거 생성
CREATE TRIGGER auto_create_bucket_on_tour_insert
  AFTER INSERT ON tours
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_tour_bucket();

-- 4단계: 설정 확인
SELECT 
  'Auto bucket creation trigger installed successfully!' as status,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'auto_create_bucket_on_tour_insert';

-- 5단계: 수동으로 누락된 bucket들이 있는지 확인하고 생성
DO $$
DECLARE
  missing_tour RECORD;
BEGIN
  -- tours 테이블에 있지만 bucket이 없는 투어들 찾기
  FOR missing_tour IN 
    SELECT t.id as tour_id
    FROM tours t
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.buckets b 
      WHERE b.id = 'tour-photos-' || t.id
    )
    AND t.tour_date >= CURRENT_DATE - INTERVAL '7 days' -- 최근 7일
  LOOP
    RAISE NOTICE 'Creating missing bucket for tour: %', missing_tour.tour_id;
    PERFORM create_tour_photo_bucket(missing_tour.tour_id);
  END LOOP;
END $$;

-- 6단계: 최종 확인 - tours 테이블의 모든 투어와 해당 bucket들
SELECT 
  t.id as tour_id,
  t.tour_date,
  t.product_id,
  CASE 
    WHEN b.id IS NOT NULL THEN '✅ Bucket exists'
    ELSE '❌ Bucket missing'
  END as bucket_status,
  b.id as bucket_name
FROM tours t
LEFT JOIN storage.buckets b ON b.id = 'tour-photos-' || t.id
WHERE t.tour_date >= CURRENT_DATE - INTERVAL '30 days' -- 최근 30일
ORDER BY t.tour_date DESC;
