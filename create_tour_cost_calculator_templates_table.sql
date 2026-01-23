-- 투어 비용 계산기 템플릿 테이블 생성
-- 투어 코스 선택과 순서를 템플릿으로 저장하고 관리

CREATE TABLE IF NOT EXISTS tour_cost_calculator_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  selected_courses JSONB NOT NULL, -- 선택된 코스 ID 배열
  course_order JSONB NOT NULL, -- 코스 순서 배열
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_cost_calculator_templates_created_by ON tour_cost_calculator_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_tour_cost_calculator_templates_created_at ON tour_cost_calculator_templates(created_at DESC);

-- RLS 정책 설정
ALTER TABLE tour_cost_calculator_templates ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Users can read their own templates" ON tour_cost_calculator_templates;
DROP POLICY IF EXISTS "Authenticated users can read templates" ON tour_cost_calculator_templates;
DROP POLICY IF EXISTS "Authenticated users can create templates" ON tour_cost_calculator_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON tour_cost_calculator_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON tour_cost_calculator_templates;

-- 모든 인증된 사용자가 템플릿을 읽을 수 있음 (공유 템플릿)
CREATE POLICY "Authenticated users can read templates"
  ON tour_cost_calculator_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 모든 인증된 사용자가 템플릿을 생성할 수 있음
CREATE POLICY "Authenticated users can create templates"
  ON tour_cost_calculator_templates
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 사용자는 자신의 템플릿만 수정할 수 있음 (또는 관리자)
CREATE POLICY "Users can update their own templates"
  ON tour_cost_calculator_templates
  FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR 
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND (team.position = 'super' OR team.position = 'admin')
      AND team.is_active = true
    )
    OR
    auth.jwt() ->> 'email' IN ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

-- 사용자는 자신의 템플릿만 삭제할 수 있음 (또는 관리자)
CREATE POLICY "Users can delete their own templates"
  ON tour_cost_calculator_templates
  FOR DELETE
  USING (
    auth.uid() = created_by 
    OR 
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND (team.position = 'super' OR team.position = 'admin')
      AND team.is_active = true
    )
    OR
    auth.jwt() ->> 'email' IN ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tour_cost_calculator_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (이미 존재하는 경우)
DROP TRIGGER IF EXISTS update_tour_cost_calculator_templates_updated_at ON tour_cost_calculator_templates;

CREATE TRIGGER update_tour_cost_calculator_templates_updated_at
  BEFORE UPDATE ON tour_cost_calculator_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_cost_calculator_templates_updated_at();

-- 코멘트 추가
COMMENT ON TABLE tour_cost_calculator_templates IS '투어 비용 계산기에서 사용하는 투어 코스 선택 템플릿';
COMMENT ON COLUMN tour_cost_calculator_templates.name IS '템플릿 이름';
COMMENT ON COLUMN tour_cost_calculator_templates.selected_courses IS '선택된 코스 ID 배열 (JSONB)';
COMMENT ON COLUMN tour_cost_calculator_templates.course_order IS '코스 순서 배열 (JSONB)';
