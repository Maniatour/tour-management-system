-- 상품과 투어 코스 연결 테이블 생성
CREATE TABLE IF NOT EXISTS product_tour_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tour_course_id UUID NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 중복 방지를 위한 유니크 제약조건
  UNIQUE(product_id, tour_course_id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_tour_courses_product_id ON product_tour_courses(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tour_courses_tour_course_id ON product_tour_courses(tour_course_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE product_tour_courses ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "product_tour_courses_select_policy" ON product_tour_courses
  FOR SELECT USING (true);

-- 인증된 사용자만 삽입 가능
CREATE POLICY "product_tour_courses_insert_policy" ON product_tour_courses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자만 업데이트 가능
CREATE POLICY "product_tour_courses_update_policy" ON product_tour_courses
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자만 삭제 가능
CREATE POLICY "product_tour_courses_delete_policy" ON product_tour_courses
  FOR DELETE USING (auth.role() = 'authenticated');

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE OR REPLACE FUNCTION update_product_tour_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_tour_courses_updated_at
  BEFORE UPDATE ON product_tour_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_product_tour_courses_updated_at();

-- 코멘트 추가
COMMENT ON TABLE product_tour_courses IS '상품과 투어 코스의 다대다 연결 테이블';
COMMENT ON COLUMN product_tour_courses.product_id IS '상품 ID';
COMMENT ON COLUMN product_tour_courses.tour_course_id IS '투어 코스 ID';
COMMENT ON COLUMN product_tour_courses.created_at IS '생성 시간';
COMMENT ON COLUMN product_tour_courses.updated_at IS '수정 시간';
