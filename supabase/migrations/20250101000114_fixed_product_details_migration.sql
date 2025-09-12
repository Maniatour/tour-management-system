-- 수정된 상품 세부정보 마이그레이션
-- 이 마이그레이션은 기존 products 테이블의 상태를 확인하고 안전하게 처리합니다.

-- product_details 테이블 생성 (이미 존재하지 않는 경우에만)
CREATE TABLE IF NOT EXISTS product_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    slogan1 TEXT,
    slogan2 TEXT,
    slogan3 TEXT,
    description TEXT,
    included TEXT,
    not_included TEXT,
    pickup_drop_info TEXT,
    luggage_info TEXT,
    tour_operation_info TEXT,
    preparation_info TEXT,
    small_group_info TEXT,
    companion_info TEXT,
    exclusive_booking_info TEXT,
    cancellation_policy TEXT,
    chat_announcement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_details_product_id ON product_details(product_id);

-- RLS 설정
ALTER TABLE product_details ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (이미 존재하지 않는 경우에만)
DO $$ 
BEGIN
    -- 모든 작업에 대한 정책 (인증된 사용자)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_details' AND policyname = 'Allow all operations on product_details for authenticated users') THEN
        CREATE POLICY "Allow all operations on product_details for authenticated users" 
        ON product_details FOR ALL 
        TO authenticated 
        USING (true);
    END IF;
    
    -- 공개 읽기 정책 (고객용)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_details' AND policyname = 'Allow public read access to product_details') THEN
        CREATE POLICY "Allow public read access to product_details" 
        ON product_details FOR SELECT 
        TO anon 
        USING (true);
    END IF;
END $$;

-- 트리거 생성 (이미 존재하지 않는 경우에만)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_details_updated_at') THEN
        CREATE TRIGGER update_product_details_updated_at 
            BEFORE UPDATE ON product_details 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 기존 products 테이블에서 세부정보 필드들이 있는지 확인하고 제거
DO $$ 
BEGIN
    -- 각 컬럼이 존재하는지 확인하고 제거
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'included') THEN
        ALTER TABLE products DROP COLUMN included;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'not_included') THEN
        ALTER TABLE products DROP COLUMN not_included;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slogan1') THEN
        ALTER TABLE products DROP COLUMN slogan1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slogan2') THEN
        ALTER TABLE products DROP COLUMN slogan2;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slogan3') THEN
        ALTER TABLE products DROP COLUMN slogan3;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description') THEN
        ALTER TABLE products DROP COLUMN description;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'pickup_drop_info') THEN
        ALTER TABLE products DROP COLUMN pickup_drop_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'luggage_info') THEN
        ALTER TABLE products DROP COLUMN luggage_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tour_operation_info') THEN
        ALTER TABLE products DROP COLUMN tour_operation_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'preparation_info') THEN
        ALTER TABLE products DROP COLUMN preparation_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'small_group_info') THEN
        ALTER TABLE products DROP COLUMN small_group_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'companion_info') THEN
        ALTER TABLE products DROP COLUMN companion_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'exclusive_booking_info') THEN
        ALTER TABLE products DROP COLUMN exclusive_booking_info;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'cancellation_policy') THEN
        ALTER TABLE products DROP COLUMN cancellation_policy;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'chat_announcement') THEN
        ALTER TABLE products DROP COLUMN chat_announcement;
    END IF;
END $$;

-- product_details 테이블에 코멘트 추가
COMMENT ON TABLE product_details IS '상품 세부정보 테이블';
COMMENT ON COLUMN product_details.product_id IS '상품 ID (외래키)';
COMMENT ON COLUMN product_details.slogan1 IS '슬로건 1';
COMMENT ON COLUMN product_details.slogan2 IS '슬로건 2';
COMMENT ON COLUMN product_details.slogan3 IS '슬로건 3';
COMMENT ON COLUMN product_details.description IS '상품 설명';
COMMENT ON COLUMN product_details.included IS '포함 사항';
COMMENT ON COLUMN product_details.not_included IS '불포함 사항';
COMMENT ON COLUMN product_details.pickup_drop_info IS '픽업/드롭 정보';
COMMENT ON COLUMN product_details.luggage_info IS '수하물 정보';
COMMENT ON COLUMN product_details.tour_operation_info IS '투어 운영 정보';
COMMENT ON COLUMN product_details.preparation_info IS '준비 사항';
COMMENT ON COLUMN product_details.small_group_info IS '소그룹 정보';
COMMENT ON COLUMN product_details.companion_info IS '동반자 정보';
COMMENT ON COLUMN product_details.exclusive_booking_info IS '독점 예약 정보';
COMMENT ON COLUMN product_details.cancellation_policy IS '취소 정책';
COMMENT ON COLUMN product_details.chat_announcement IS '채팅 공지사항';
