-- 지출 값 정규화 매핑 테이블 생성
-- 원본 paid_for/category 값을 정규화된 값으로 매핑

CREATE TABLE IF NOT EXISTS expense_normalization_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  source_table TEXT NOT NULL, -- 'tour_expenses', 'reservation_expenses', 'company_expenses'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(original_value, source_table)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_expense_normalization_mappings_original ON expense_normalization_mappings(original_value);
CREATE INDEX IF NOT EXISTS idx_expense_normalization_mappings_normalized ON expense_normalization_mappings(normalized_value);
CREATE INDEX IF NOT EXISTS idx_expense_normalization_mappings_source ON expense_normalization_mappings(source_table);

-- RLS 정책
ALTER TABLE expense_normalization_mappings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Authenticated users can read normalization mappings" ON expense_normalization_mappings;
DROP POLICY IF EXISTS "Authenticated users can insert normalization mappings" ON expense_normalization_mappings;
DROP POLICY IF EXISTS "Authenticated users can update normalization mappings" ON expense_normalization_mappings;
DROP POLICY IF EXISTS "Authenticated users can delete normalization mappings" ON expense_normalization_mappings;

-- 모든 인증된 사용자 읽기 허용
CREATE POLICY "Authenticated users can read normalization mappings"
  ON expense_normalization_mappings FOR SELECT
  TO authenticated
  USING (true);

-- 인증된 사용자 수정 허용
CREATE POLICY "Authenticated users can insert normalization mappings"
  ON expense_normalization_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update normalization mappings"
  ON expense_normalization_mappings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete normalization mappings"
  ON expense_normalization_mappings FOR DELETE
  TO authenticated
  USING (true);

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_expense_normalization_mappings_timestamp ON expense_normalization_mappings;

CREATE TRIGGER update_expense_normalization_mappings_timestamp
  BEFORE UPDATE ON expense_normalization_mappings
  FOR EACH ROW EXECUTE FUNCTION update_expense_mapping_timestamp();
