-- Product Options 테이블 수정 (프론트엔드 요구사항에 맞게)
-- 기존 테이블 삭제 후 재생성
DROP TABLE IF EXISTS product_options CASCADE;

-- Product Options 테이블 (기본 옵션 정보)
CREATE TABLE product_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  is_multiple BOOLEAN DEFAULT false,
  linked_option_id UUID REFERENCES options(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Option Choices 테이블 (선택 항목들)
CREATE TABLE product_option_choices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_option_id UUID REFERENCES product_options(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  adult_price_adjustment DECIMAL(10,2) DEFAULT 0,
  child_price_adjustment DECIMAL(10,2) DEFAULT 0,
  infant_price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_product_options_product_id ON product_options(product_id);
CREATE INDEX idx_product_options_linked_option_id ON product_options(linked_option_id);
CREATE INDEX idx_product_option_choices_option_id ON product_option_choices(product_option_id);

-- RLS 활성화
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_choices ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
CREATE POLICY "Allow public access on product_options" ON product_options FOR ALL USING (true);
CREATE POLICY "Allow public access on product_option_choices" ON product_option_choices FOR ALL USING (true);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_product_options_updated_at 
    BEFORE UPDATE ON product_options 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_option_choices_updated_at 
    BEFORE UPDATE ON product_option_choices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
