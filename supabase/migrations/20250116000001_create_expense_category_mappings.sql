-- 지출 카테고리 매핑 테이블 생성
-- 원본 paid_for 값을 표준 세금 보고용 카테고리로 매핑

-- 표준 카테고리 테이블
CREATE TABLE IF NOT EXISTS expense_standard_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ko TEXT,
  description TEXT,
  tax_deductible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 카테고리 매핑 테이블
CREATE TABLE IF NOT EXISTS expense_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_value TEXT NOT NULL,
  standard_category_id TEXT REFERENCES expense_standard_categories(id) ON DELETE SET NULL,
  source_table TEXT NOT NULL, -- 'tour_expenses', 'reservation_expenses', 'company_expenses', 'ticket_bookings'
  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(original_value, source_table)
);

-- 기본 표준 카테고리 삽입
INSERT INTO expense_standard_categories (id, name, name_ko, description, tax_deductible, display_order) VALUES
  ('CAT001', 'Transportation', '교통비', '차량 연료, 렌트, 주차, 통행료 등', true, 1),
  ('CAT002', 'Meals & Entertainment', '식비/접대비', '식사, 음료, 고객 접대 등', true, 2),
  ('CAT003', 'Accommodation', '숙박비', '호텔, 숙소 비용', true, 3),
  ('CAT004', 'Admission Fees', '입장료', '관광지, 박물관, 공연 입장료', true, 4),
  ('CAT005', 'Equipment & Supplies', '장비/소모품', '투어 장비, 사무용품 등', true, 5),
  ('CAT006', 'Personnel Costs', '인건비', '가이드비, 어시스턴트비, 아르바이트 등', true, 6),
  ('CAT007', 'Marketing & Advertising', '마케팅/광고비', '광고, 홍보, 마케팅 비용', true, 7),
  ('CAT008', 'Office & Utilities', '사무실/공과금', '임대료, 전기, 수도, 인터넷 등', true, 8),
  ('CAT009', 'Insurance', '보험료', '여행자 보험, 차량 보험 등', true, 9),
  ('CAT010', 'Fees & Commissions', '수수료', '결제 수수료, 채널 수수료 등', true, 10),
  ('CAT011', 'Tips & Gratuities', '팁', '팁, 사례금', true, 11),
  ('CAT012', 'Miscellaneous', '기타', '분류되지 않은 기타 비용', true, 99)
ON CONFLICT (id) DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_expense_category_mappings_original ON expense_category_mappings(original_value);
CREATE INDEX IF NOT EXISTS idx_expense_category_mappings_standard ON expense_category_mappings(standard_category_id);
CREATE INDEX IF NOT EXISTS idx_expense_category_mappings_source ON expense_category_mappings(source_table);

-- RLS 정책
ALTER TABLE expense_standard_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_mappings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Authenticated users can read standard categories" ON expense_standard_categories;
DROP POLICY IF EXISTS "Authenticated users can read category mappings" ON expense_category_mappings;
DROP POLICY IF EXISTS "Authenticated users can insert category mappings" ON expense_category_mappings;
DROP POLICY IF EXISTS "Authenticated users can update category mappings" ON expense_category_mappings;
DROP POLICY IF EXISTS "Authenticated users can manage standard categories" ON expense_standard_categories;

-- 모든 인증된 사용자 읽기 허용
CREATE POLICY "Authenticated users can read standard categories"
  ON expense_standard_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read category mappings"
  ON expense_category_mappings FOR SELECT
  TO authenticated
  USING (true);

-- 인증된 사용자 수정 허용
CREATE POLICY "Authenticated users can insert category mappings"
  ON expense_category_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update category mappings"
  ON expense_category_mappings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage standard categories"
  ON expense_standard_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_expense_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (이미 존재하는 경우)
DROP TRIGGER IF EXISTS update_expense_category_mappings_timestamp ON expense_category_mappings;
DROP TRIGGER IF EXISTS update_expense_standard_categories_timestamp ON expense_standard_categories;

CREATE TRIGGER update_expense_category_mappings_timestamp
  BEFORE UPDATE ON expense_category_mappings
  FOR EACH ROW EXECUTE FUNCTION update_expense_mapping_timestamp();

CREATE TRIGGER update_expense_standard_categories_timestamp
  BEFORE UPDATE ON expense_standard_categories
  FOR EACH ROW EXECUTE FUNCTION update_expense_mapping_timestamp();
