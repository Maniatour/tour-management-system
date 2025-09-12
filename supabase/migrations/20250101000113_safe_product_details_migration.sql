-- 안전한 상품 세부정보 마이그레이션
-- 이 마이그레이션은 기존 데이터를 보존하면서 안전하게 product_details 테이블을 생성합니다.

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

-- 정책 생성
CREATE POLICY IF NOT EXISTS "Allow all operations on product_details for authenticated users" 
ON product_details FOR ALL TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read access to product_details" 
ON product_details FOR SELECT TO anon USING (true);

-- 트리거 생성
CREATE TRIGGER IF NOT EXISTS update_product_details_updated_at 
    BEFORE UPDATE ON product_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기존 데이터 마이그레이션 (안전하게)
INSERT INTO product_details (
    product_id, slogan1, slogan2, slogan3, description, included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info, exclusive_booking_info, cancellation_policy, chat_announcement
)
SELECT 
    id, slogan1, slogan2, slogan3, description, included, not_included,
    pickup_drop_info, luggage_info, tour_operation_info, preparation_info,
    small_group_info, companion_info, exclusive_booking_info, cancellation_policy, chat_announcement
FROM products 
WHERE id NOT IN (SELECT product_id FROM product_details)
ON CONFLICT (product_id) DO NOTHING;
