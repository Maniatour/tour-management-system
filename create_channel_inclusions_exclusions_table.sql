-- 채널별 포함/불포함 사항 테이블 생성
-- 각 채널별로 다른 포함/불포함 사항을 저장할 수 있도록 함

CREATE TABLE IF NOT EXISTS channel_inclusions_exclusions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    
    -- 한국어 포함/불포함 사항
    inclusions_ko TEXT,
    exclusions_ko TEXT,
    
    -- 영어 포함/불포함 사항
    inclusions_en TEXT,
    exclusions_en TEXT,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    
    -- 복합 유니크 제약조건: 같은 상품, 같은 채널에 중복 데이터 방지
    UNIQUE(product_id, channel_id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_channel_inclusions_exclusions_product_id ON channel_inclusions_exclusions(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_inclusions_exclusions_channel_id ON channel_inclusions_exclusions(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_inclusions_exclusions_composite ON channel_inclusions_exclusions(product_id, channel_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE channel_inclusions_exclusions ENABLE ROW LEVEL SECURITY;

-- 모든 작업에 대한 정책 (인증된 사용자)
CREATE POLICY "Allow all operations on channel_inclusions_exclusions for authenticated users" 
ON channel_inclusions_exclusions FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 공개 읽기 정책 (고객용)
CREATE POLICY "Allow public read access to channel_inclusions_exclusions" 
ON channel_inclusions_exclusions FOR SELECT 
TO anon 
USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE TRIGGER update_channel_inclusions_exclusions_updated_at 
    BEFORE UPDATE ON channel_inclusions_exclusions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 컬럼에 대한 코멘트 추가
COMMENT ON TABLE channel_inclusions_exclusions IS '채널별 포함/불포함 사항 정보';
COMMENT ON COLUMN channel_inclusions_exclusions.product_id IS '상품 ID';
COMMENT ON COLUMN channel_inclusions_exclusions.channel_id IS '채널 ID';
COMMENT ON COLUMN channel_inclusions_exclusions.inclusions_ko IS '포함 사항 (한국어)';
COMMENT ON COLUMN channel_inclusions_exclusions.exclusions_ko IS '불포함 사항 (한국어)';
COMMENT ON COLUMN channel_inclusions_exclusions.inclusions_en IS '포함 사항 (영어)';
COMMENT ON COLUMN channel_inclusions_exclusions.exclusions_en IS '불포함 사항 (영어)';

-- 예시 데이터 삽입 (테스트용)
-- INSERT INTO channel_inclusions_exclusions (product_id, channel_id, inclusions_ko, exclusions_ko, inclusions_en, exclusions_en) 
-- VALUES 
--     ('your-product-id', 'your-channel-id', 
--      '• 전문 가이드 서비스\n• 교통편 (왕복)\n• 모든 입장료\n• 점심 식사\n• 여행자 보험',
--      '• 개인 경비\n• 숙박비\n• 항공료\n• 개인 보험\n• 기념품 및 쇼핑',
--      '• Professional guide service\n• Round-trip transportation\n• All entrance fees\n• Lunch\n• Travel insurance',
--      '• Personal expenses\n• Accommodation\n• Airfare\n• Personal insurance\n• Souvenirs and shopping')
-- ON CONFLICT (product_id, channel_id) DO NOTHING;
