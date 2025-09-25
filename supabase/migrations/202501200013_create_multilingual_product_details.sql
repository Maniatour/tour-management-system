-- 다국어 상품 상세정보 지원을 위한 마이그레이션
-- 기존 product_details 테이블을 다국어 지원 구조로 변경

-- 1. 새로운 다국어 상품 상세정보 테이블 생성
CREATE TABLE IF NOT EXISTS product_details_multilingual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    language_code VARCHAR(5) NOT NULL DEFAULT 'ko', -- 'ko', 'en', 'ja', 'zh' 등
    
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
    
    -- 유니크 제약조건 (상품당 언어별로 하나의 세부정보만)
    UNIQUE(product_id, language_code)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_product_id ON product_details_multilingual(product_id);
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_language ON product_details_multilingual(language_code);
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_product_language ON product_details_multilingual(product_id, language_code);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE product_details_multilingual ENABLE ROW LEVEL SECURITY;

-- 모든 작업에 대한 정책 (인증된 사용자)
CREATE POLICY "Allow all operations on product_details_multilingual for authenticated users" 
ON product_details_multilingual FOR ALL 
TO authenticated 
USING (true);

-- 공개 읽기 정책 (고객용)
CREATE POLICY "Allow public read access to product_details_multilingual" 
ON product_details_multilingual FOR SELECT 
TO anon 
USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE TRIGGER update_product_details_multilingual_updated_at 
    BEFORE UPDATE ON product_details_multilingual 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. 공통 상품 세부정보도 다국어 지원으로 변경
CREATE TABLE IF NOT EXISTS product_details_common_multilingual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sub_category TEXT NOT NULL,
    language_code VARCHAR(5) NOT NULL DEFAULT 'ko',

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
    
    -- 유니크 제약조건 (sub_category당 언어별로 하나의 공통 세부정보만)
    UNIQUE(sub_category, language_code)
);

CREATE INDEX IF NOT EXISTS idx_product_details_common_multilingual_sub_category ON product_details_common_multilingual(sub_category);
CREATE INDEX IF NOT EXISTS idx_product_details_common_multilingual_language ON product_details_common_multilingual(language_code);
CREATE INDEX IF NOT EXISTS idx_product_details_common_multilingual_sub_category_language ON product_details_common_multilingual(sub_category, language_code);

-- RLS 설정
ALTER TABLE product_details_common_multilingual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on product_details_common_multilingual for authenticated users"
ON product_details_common_multilingual FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_product_details_common_multilingual_updated_at
  BEFORE UPDATE ON product_details_common_multilingual
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. 기존 데이터를 새로운 구조로 마이그레이션
-- 기존 product_details 데이터를 한국어(ko)로 마이그레이션
INSERT INTO product_details_multilingual (
    product_id, language_code,
    slogan1, slogan2, slogan3, description,
    included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info,
    exclusive_booking_info, cancellation_policy,
    chat_announcement,
    created_at, updated_at
)
SELECT 
    product_id, 'ko' as language_code,
    slogan1, slogan2, slogan3, description,
    included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info,
    exclusive_booking_info, cancellation_policy,
    chat_announcement,
    created_at, updated_at
FROM product_details
WHERE EXISTS (SELECT 1 FROM product_details);

-- 기존 product_details_common 데이터를 한국어(ko)로 마이그레이션
INSERT INTO product_details_common_multilingual (
    sub_category, language_code,
    slogan1, slogan2, slogan3, description,
    included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info,
    exclusive_booking_info, cancellation_policy,
    chat_announcement,
    created_at, updated_at
)
SELECT 
    sub_category, 'ko' as language_code,
    slogan1, slogan2, slogan3, description,
    included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info,
    exclusive_booking_info, cancellation_policy,
    chat_announcement,
    created_at, updated_at
FROM product_details_common
WHERE EXISTS (SELECT 1 FROM product_details_common);

-- 4. 기존 테이블 백업 후 삭제 (안전을 위해 주석 처리)
-- 기존 테이블을 백업 테이블로 이름 변경
-- ALTER TABLE product_details RENAME TO product_details_backup;
-- ALTER TABLE product_details_common RENAME TO product_details_common_backup;

-- 코멘트 추가
COMMENT ON TABLE product_details_multilingual IS '다국어 상품 세부정보 테이블';
COMMENT ON COLUMN product_details_multilingual.product_id IS '상품 ID (외래키)';
COMMENT ON COLUMN product_details_multilingual.language_code IS '언어 코드 (ko, en, ja, zh 등)';
COMMENT ON COLUMN product_details_multilingual.slogan1 IS '슬로건 1';
COMMENT ON COLUMN product_details_multilingual.slogan2 IS '슬로건 2';
COMMENT ON COLUMN product_details_multilingual.slogan3 IS '슬로건 3';
COMMENT ON COLUMN product_details_multilingual.description IS '상품 설명';
COMMENT ON COLUMN product_details_multilingual.included IS '포함 사항';
COMMENT ON COLUMN product_details_multilingual.not_included IS '불포함 사항';
COMMENT ON COLUMN product_details_multilingual.pickup_drop_info IS '픽업/드롭 정보';
COMMENT ON COLUMN product_details_multilingual.luggage_info IS '수하물 정보';
COMMENT ON COLUMN product_details_multilingual.tour_operation_info IS '투어 운영 정보';
COMMENT ON COLUMN product_details_multilingual.preparation_info IS '준비 사항';
COMMENT ON COLUMN product_details_multilingual.small_group_info IS '소그룹 정보';
COMMENT ON COLUMN product_details_multilingual.companion_info IS '동반자 정보';
COMMENT ON COLUMN product_details_multilingual.exclusive_booking_info IS '독점 예약 정보';
COMMENT ON COLUMN product_details_multilingual.cancellation_policy IS '취소 정책';
COMMENT ON COLUMN product_details_multilingual.chat_announcement IS '채팅 공지사항';

COMMENT ON TABLE product_details_common_multilingual IS '다국어 sub_category별 공통 상품 세부정보';
COMMENT ON COLUMN product_details_common_multilingual.sub_category IS '상품 소분류 (공통키)';
COMMENT ON COLUMN product_details_common_multilingual.language_code IS '언어 코드 (ko, en, ja, zh 등)';
