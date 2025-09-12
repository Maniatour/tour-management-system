-- 상품 세부정보를 위한 별도 테이블 생성
-- 이 마이그레이션은 products 테이블에서 세부정보 필드들을 분리하여 별도 테이블로 만듭니다.

-- 상품 세부정보 테이블 생성
CREATE TABLE IF NOT EXISTS product_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    -- 유니크 제약조건 (상품당 하나의 세부정보만)
    UNIQUE(product_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_details_product_id ON product_details(product_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE product_details ENABLE ROW LEVEL SECURITY;

-- 모든 작업에 대한 정책 (인증된 사용자)
CREATE POLICY "Allow all operations on product_details for authenticated users" 
ON product_details FOR ALL 
TO authenticated 
USING (true);

-- 공개 읽기 정책 (고객용)
CREATE POLICY "Allow public read access to product_details" 
ON product_details FOR SELECT 
TO anon 
USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE TRIGGER update_product_details_updated_at 
    BEFORE UPDATE ON product_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기존 products 테이블에서 세부정보 필드들 제거
ALTER TABLE products 
DROP COLUMN IF EXISTS included,
DROP COLUMN IF EXISTS not_included,
DROP COLUMN IF EXISTS slogan1,
DROP COLUMN IF EXISTS slogan2,
DROP COLUMN IF EXISTS slogan3,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS pickup_drop_info,
DROP COLUMN IF EXISTS luggage_info,
DROP COLUMN IF EXISTS tour_operation_info,
DROP COLUMN IF EXISTS preparation_info,
DROP COLUMN IF EXISTS small_group_info,
DROP COLUMN IF EXISTS companion_info,
DROP COLUMN IF EXISTS exclusive_booking_info,
DROP COLUMN IF EXISTS cancellation_policy,
DROP COLUMN IF EXISTS chat_announcement;

-- 기존 products 테이블의 코멘트 제거
COMMENT ON COLUMN products.included IS NULL;
COMMENT ON COLUMN products.not_included IS NULL;
COMMENT ON COLUMN products.slogan1 IS NULL;
COMMENT ON COLUMN products.slogan2 IS NULL;
COMMENT ON COLUMN products.slogan3 IS NULL;
COMMENT ON COLUMN products.description IS NULL;
COMMENT ON COLUMN products.pickup_drop_info IS NULL;
COMMENT ON COLUMN products.luggage_info IS NULL;
COMMENT ON COLUMN products.tour_operation_info IS NULL;
COMMENT ON COLUMN products.preparation_info IS NULL;
COMMENT ON COLUMN products.small_group_info IS NULL;
COMMENT ON COLUMN products.companion_info IS NULL;
COMMENT ON COLUMN products.exclusive_booking_info IS NULL;
COMMENT ON COLUMN products.cancellation_policy IS NULL;
COMMENT ON COLUMN products.chat_announcement IS NULL;

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
