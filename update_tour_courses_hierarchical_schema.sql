-- 투어 코스 시스템을 계층적 구조로 업데이트
-- 상품과 연결하고 고객/팀원용 내용을 분리

-- 1. 기존 tour_courses 테이블에 계층적 구조 필드 추가
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES tour_courses(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS path TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
-- 고객용 필드
ADD COLUMN IF NOT EXISTS customer_name_ko VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_name_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_description_ko TEXT,
ADD COLUMN IF NOT EXISTS customer_description_en TEXT,
-- 팀원용 필드
ADD COLUMN IF NOT EXISTS team_name_ko VARCHAR(255),
ADD COLUMN IF NOT EXISTS team_name_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS team_description_ko TEXT,
ADD COLUMN IF NOT EXISTS team_description_en TEXT,
ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_courses_product_id ON tour_courses(product_id);
CREATE INDEX IF NOT EXISTS idx_tour_courses_parent_id ON tour_courses(parent_id);
CREATE INDEX IF NOT EXISTS idx_tour_courses_level ON tour_courses(level);
CREATE INDEX IF NOT EXISTS idx_tour_courses_path ON tour_courses(path);

-- 3. 기존 데이터 마이그레이션 (name_ko/en을 customer_name_ko/en으로 복사)
UPDATE tour_courses 
SET customer_name_ko = name_ko,
    customer_name_en = name_en,
    team_name_ko = name_ko,
    team_name_en = name_en
WHERE customer_name_ko IS NULL;

-- 4. 투어 코스 연결 테이블 생성 (트레일/경로 정보)
CREATE TABLE IF NOT EXISTS tour_course_connections (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  from_course_id TEXT NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  to_course_id TEXT NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  connection_type VARCHAR(50) DEFAULT 'trail', -- trail, road, path, etc.
  name_ko VARCHAR(255),
  name_en VARCHAR(255),
  description_ko TEXT,
  description_en TEXT,
  distance_km DECIMAL(8,2),
  duration_minutes INTEGER,
  difficulty_level VARCHAR(20) DEFAULT 'easy',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 투어 코스 카테고리 테이블 (기존 테이블이 있으면 컬럼 타입 수정)
DO $$ 
BEGIN
  -- 테이블이 존재하지 않으면 생성
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tour_course_categories') THEN
    CREATE TABLE tour_course_categories (
      id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
      name_ko VARCHAR(255) NOT NULL,
      name_en VARCHAR(255) NOT NULL,
      description_ko TEXT,
      description_en TEXT,
      color VARCHAR(7) DEFAULT '#3B82F6',
      icon VARCHAR(50) DEFAULT 'map-pin',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- 기존 테이블이 있으면 id 컬럼을 TEXT로 변경
    BEGIN
      ALTER TABLE tour_course_categories ALTER COLUMN id TYPE TEXT USING id::text;
    EXCEPTION WHEN OTHERS THEN
      -- 이미 TEXT 타입이거나 변경할 수 없는 경우 무시
      NULL;
    END;
  END IF;
END $$;

-- 6. 업데이트 시간 트리거 함수 (이미 존재한다면 스킵)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 생성 (기존 트리거가 있으면 스킵)
DO $$ 
BEGIN
  -- tour_courses 테이블 트리거
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_tour_courses_updated_at'
  ) THEN
    CREATE TRIGGER update_tour_courses_updated_at 
      BEFORE UPDATE ON tour_courses 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- tour_course_connections 테이블 트리거
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_tour_course_connections_updated_at'
  ) THEN
    CREATE TRIGGER update_tour_course_connections_updated_at 
      BEFORE UPDATE ON tour_course_connections 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- tour_course_categories 테이블 트리거
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_tour_course_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_tour_course_categories_updated_at 
      BEFORE UPDATE ON tour_course_categories 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8. 계층 구조 업데이트 함수
CREATE OR REPLACE FUNCTION update_tour_course_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- path 업데이트
  IF NEW.parent_id IS NULL THEN
    NEW.path = NEW.id::text;
    NEW.level = 1;
  ELSE
    SELECT path, level INTO NEW.path, NEW.level
    FROM tour_courses 
    WHERE id = NEW.parent_id;
    
    NEW.path = NEW.path || '.' || NEW.id::text;
    NEW.level = NEW.level + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 계층 구조 트리거
CREATE TRIGGER update_tour_course_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON tour_courses
  FOR EACH ROW EXECUTE FUNCTION update_tour_course_hierarchy();

-- 10. RLS 정책 설정
ALTER TABLE tour_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_course_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_course_categories ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "tour_courses_read_policy" ON tour_courses FOR SELECT USING (true);
CREATE POLICY "tour_course_connections_read_policy" ON tour_course_connections FOR SELECT USING (true);
CREATE POLICY "tour_course_categories_read_policy" ON tour_course_categories FOR SELECT USING (true);

-- 인증된 사용자만 쓰기 가능
CREATE POLICY "tour_courses_write_policy" ON tour_courses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "tour_course_connections_write_policy" ON tour_course_connections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "tour_course_categories_write_policy" ON tour_course_categories FOR ALL USING (auth.role() = 'authenticated');

-- 11. 기본 카테고리 데이터는 필요시 관리자 페이지에서 추가
