-- 전역 초이스 템플릿 테이블 생성
-- 상품별 초이스와 분리된 전역 템플릿 시스템

-- 1. 전역 초이스 템플릿 테이블
CREATE TABLE IF NOT EXISTS global_choice_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_name TEXT NOT NULL, -- 예: '숙박 선택', '교통 선택'
  template_name_ko TEXT NOT NULL, -- 예: '숙박 선택', '교통 선택'
  description TEXT,
  choice_type TEXT NOT NULL DEFAULT 'single', -- 'single', 'multiple', 'quantity'
  is_required BOOLEAN DEFAULT true,
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  category TEXT, -- 예: 'accommodation', 'transportation', 'meal'
  tags TEXT[], -- 태그 배열
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(template_name)
);

-- 2. 전역 초이스 템플릿 옵션 테이블
CREATE TABLE IF NOT EXISTS global_choice_template_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES global_choice_templates(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL, -- 예: 'single_room', 'double_room'
  option_name TEXT NOT NULL, -- 예: 'Single Room'
  option_name_ko TEXT NOT NULL, -- 예: '1인 1실'
  description TEXT,
  adult_price DECIMAL(10,2) DEFAULT 0,
  child_price DECIMAL(10,2) DEFAULT 0,
  infant_price DECIMAL(10,2) DEFAULT 0,
  capacity INTEGER DEFAULT 1, -- 수용 인원
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(template_id, option_key)
);

-- 3. 상품별 초이스 템플릿 연결 테이블
CREATE TABLE IF NOT EXISTS product_choice_template_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  template_id UUID REFERENCES global_choice_templates(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, template_id)
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_global_choice_templates_category ON global_choice_templates(category);
CREATE INDEX IF NOT EXISTS idx_global_choice_templates_active ON global_choice_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_global_choice_template_options_template_id ON global_choice_template_options(template_id);
CREATE INDEX IF NOT EXISTS idx_product_choice_template_links_product_id ON product_choice_template_links(product_id);
CREATE INDEX IF NOT EXISTS idx_product_choice_template_links_template_id ON product_choice_template_links(template_id);

-- 5. 샘플 데이터 삽입
INSERT INTO global_choice_templates (template_name, template_name_ko, description, choice_type, category, tags) VALUES
('Accommodation Choice', '숙박 선택', '숙박 타입을 선택하세요', 'single', 'accommodation', ARRAY['숙박', 'accommodation']),
('Transportation Choice', '교통 선택', '교통 수단을 선택하세요', 'single', 'transportation', ARRAY['교통', 'transportation']),
('Meal Choice', '식사 선택', '식사 옵션을 선택하세요', 'multiple', 'meal', ARRAY['식사', 'meal']),
('Activity Choice', '액티비티 선택', '액티비티를 선택하세요', 'quantity', 'activity', ARRAY['액티비티', 'activity']);

-- 6. 샘플 옵션 데이터 삽입
-- 숙박 선택 옵션
INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'single_room',
  'Single Room',
  '1인 1실',
  0, 0, 0, 1, true
FROM global_choice_templates t WHERE t.template_name = 'Accommodation Choice';

INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'double_room',
  'Double Room',
  '2인 1실',
  50, 25, 0, 2, false
FROM global_choice_templates t WHERE t.template_name = 'Accommodation Choice';

INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'triple_room',
  'Triple Room',
  '3인 1실',
  75, 37.5, 0, 3, false
FROM global_choice_templates t WHERE t.template_name = 'Accommodation Choice';

-- 교통 선택 옵션
INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'bus',
  'Bus',
  '버스',
  0, 0, 0, 50, true
FROM global_choice_templates t WHERE t.template_name = 'Transportation Choice';

INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'van',
  'Van',
  '밴',
  100, 50, 0, 15, false
FROM global_choice_templates t WHERE t.template_name = 'Transportation Choice';

-- 식사 선택 옵션
INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'breakfast',
  'Breakfast',
  '아침식사',
  25, 12.5, 0, 1, false
FROM global_choice_templates t WHERE t.template_name = 'Meal Choice';

INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'lunch',
  'Lunch',
  '점심식사',
  35, 17.5, 0, 1, false
FROM global_choice_templates t WHERE t.template_name = 'Meal Choice';

INSERT INTO global_choice_template_options (template_id, option_key, option_name, option_name_ko, adult_price, child_price, infant_price, capacity, is_default) 
SELECT 
  t.id,
  'dinner',
  'Dinner',
  '저녁식사',
  45, 22.5, 0, 1, false
FROM global_choice_templates t WHERE t.template_name = 'Meal Choice';

-- 7. 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_global_choice_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_global_choice_templates_updated_at
  BEFORE UPDATE ON global_choice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_global_choice_templates_updated_at();

CREATE TRIGGER trigger_update_global_choice_template_options_updated_at
  BEFORE UPDATE ON global_choice_template_options
  FOR EACH ROW
  EXECUTE FUNCTION update_global_choice_templates_updated_at();
