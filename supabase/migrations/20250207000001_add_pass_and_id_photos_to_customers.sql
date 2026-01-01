-- 고객 테이블에 패스 사진과 ID 사진 컬럼 추가
-- 작성일: 2025-02-07

-- customers 테이블에 pass_photo_url과 id_photo_url 컬럼 추가
DO $$ 
BEGIN
  -- 패스 사진 URL 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'pass_photo_url'
  ) THEN
    ALTER TABLE customers 
    ADD COLUMN pass_photo_url TEXT;
    
    COMMENT ON COLUMN customers.pass_photo_url IS '비거주자 패스 보유자의 패스 사진 URL';
  END IF;

  -- ID 사진 URL 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'id_photo_url'
  ) THEN
    ALTER TABLE customers 
    ADD COLUMN id_photo_url TEXT;
    
    COMMENT ON COLUMN customers.id_photo_url IS '비거주자 패스 보유자의 ID 사진 URL (이름 대조용)';
  END IF;
END $$;

-- Storage 버킷 생성 (이미 존재하는 경우 무시)
-- 참고: Storage 버킷은 Supabase Dashboard에서 수동으로 생성해야 할 수도 있습니다.
-- 버킷 이름: customer-documents
-- 공개 여부: false (비공개)
-- 파일 크기 제한: 5MB

