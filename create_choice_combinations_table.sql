-- 초이스 조합 가격 테이블 생성
-- 여러 그룹의 초이스 조합에 따른 가격을 저장

CREATE TABLE IF NOT EXISTS choice_combinations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  pricing_rule_id UUID REFERENCES dynamic_pricing(id) ON DELETE CASCADE,
  combination_key TEXT NOT NULL, -- 예: "antelope_lower+single_room"
  combination_name TEXT NOT NULL, -- 예: "Lower Antelope Canyon + 1인 1실"
  combination_name_ko TEXT, -- 예: "로어 앤텔로프 캐년 + 1인 1실"
  adult_price DECIMAL(10,2) DEFAULT 0,
  child_price DECIMAL(10,2) DEFAULT 0,
  infant_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 조합 키와 가격 규칙의 유니크 제약
  UNIQUE(product_id, pricing_rule_id, combination_key)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_choice_combinations_product_id ON choice_combinations(product_id);
CREATE INDEX IF NOT EXISTS idx_choice_combinations_pricing_rule_id ON choice_combinations(pricing_rule_id);
CREATE INDEX IF NOT EXISTS idx_choice_combinations_combination_key ON choice_combinations(combination_key);

-- RLS 활성화
ALTER TABLE choice_combinations ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (팀 기반 접근)
CREATE POLICY "choice_combinations_team_access" ON choice_combinations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN teams t ON p.team_id = t.id
      WHERE p.id = choice_combinations.product_id
      AND t.id = auth.jwt() ->> 'team_id'
    )
  );

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_choice_combinations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_choice_combinations_updated_at
  BEFORE UPDATE ON choice_combinations
  FOR EACH ROW
  EXECUTE FUNCTION update_choice_combinations_updated_at();

-- 테이블 코멘트
COMMENT ON TABLE choice_combinations IS '초이스 그룹 조합별 가격 정보를 저장하는 테이블';
COMMENT ON COLUMN choice_combinations.combination_key IS '초이스 조합을 식별하는 키 (예: "antelope_lower+single_room")';
COMMENT ON COLUMN choice_combinations.combination_name IS '초이스 조합의 표시명 (영문)';
COMMENT ON COLUMN choice_combinations.combination_name_ko IS '초이스 조합의 표시명 (한글)';
