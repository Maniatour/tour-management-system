-- 공통 상품 세부정보 테이블 생성 (sub_category 단위)

CREATE TABLE IF NOT EXISTS product_details_common (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sub_category TEXT NOT NULL UNIQUE,

    -- 기본 정보
    slogan1 TEXT,
    slogan2 TEXT,
    slogan3 TEXT,
    description TEXT,

    -- 포함/불포함 사항
    included TEXT,
    not_included TEXT,

    -- 투어 정보
    pickup_drop_info TEXT,
    luggage_info TEXT,
    tour_operation_info TEXT,
    preparation_info TEXT,

    -- 그룹 정보
    small_group_info TEXT,
    companion_info TEXT,

    -- 예약 및 정책 정보
    exclusive_booking_info TEXT,
    cancellation_policy TEXT,

    -- 채팅 공지사항
    chat_announcement TEXT,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_details_common_sub_category ON product_details_common(sub_category);

-- RLS 설정
ALTER TABLE product_details_common ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_details_common' AND policyname = 'Allow all operations on product_details_common for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations on product_details_common for authenticated users"
    ON product_details_common FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- updated_at 자동 갱신 트리거
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_details_common_updated_at') THEN
    CREATE TRIGGER update_product_details_common_updated_at
      BEFORE UPDATE ON product_details_common
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- products 테이블에 공통 세부정보 사용 여부 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'use_common_details'
  ) THEN
    ALTER TABLE products ADD COLUMN use_common_details BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

COMMENT ON TABLE product_details_common IS 'sub_category별 공통 상품 세부정보';
COMMENT ON COLUMN product_details_common.sub_category IS '상품 소분류 (공통키)';

