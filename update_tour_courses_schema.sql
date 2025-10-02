-- 투어 코스 관리 기능 개선을 위한 데이터베이스 스키마 업데이트
-- 1. 카테고리 관리 테이블 생성
-- 2. 투어 코스 테이블에 새로운 필드 추가
-- 3. 투어 코스 사진 테이블 생성
-- 4. 투어 코스 포인트 테이블 생성

-- 1. 투어 코스 카테고리 관리 테이블 생성
CREATE TABLE IF NOT EXISTS tour_course_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6', -- 카테고리 색상
  icon VARCHAR(50) DEFAULT 'map-pin', -- Lucide 아이콘 이름
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 카테고리 데이터 삽입
INSERT INTO tour_course_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) VALUES
('시티 투어', 'City Tour', '도시 중심의 관광 투어', 'Urban sightseeing tours', '#3B82F6', 'building', 1),
('자연 투어', 'Nature Tour', '자연 경관 중심의 투어', 'Nature-focused tours', '#10B981', 'trees', 2),
('어드벤처 투어', 'Adventure Tour', '모험과 체험 중심의 투어', 'Adventure and experience tours', '#F59E0B', 'mountain', 3),
('문화 투어', 'Cultural Tour', '문화재와 역사 중심의 투어', 'Cultural and historical tours', '#8B5CF6', 'landmark', 4),
('푸드 투어', 'Food Tour', '음식과 요리 중심의 투어', 'Food and culinary tours', '#EF4444', 'utensils', 5),
('나이트 투어', 'Night Tour', '야간 관광 투어', 'Night sightseeing tours', '#6366F1', 'moon', 6),
('투어 포인트', 'Tour Point', '특정 관광지 포인트', 'Specific tourist points', '#06B6D4', 'map-pin', 7)
ON CONFLICT DO NOTHING;

-- 2. 기존 tour_courses 테이블에 새로운 필드 추가
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS point_name VARCHAR(255), -- 포인트 이름 (예: Grand Canyon, South Rim Mather Point)
ADD COLUMN IF NOT EXISTS location VARCHAR(255), -- 위치 정보 (예: 3V6R+MW Grand Canyon Village, Arizona)
ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 8), -- 시작 위도
ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(11, 8), -- 시작 경도
ADD COLUMN IF NOT EXISTS end_latitude DECIMAL(10, 8), -- 종료 위도
ADD COLUMN IF NOT EXISTS end_longitude DECIMAL(11, 8), -- 종료 경도
ADD COLUMN IF NOT EXISTS internal_note TEXT, -- 인터널 노트 (관리자만 볼 수 있는)
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES tour_course_categories(id); -- 카테고리 참조

-- 3. 투어 코스 사진 테이블 생성
CREATE TABLE IF NOT EXISTS tour_course_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  thumbnail_url VARCHAR(500), -- 썸네일 URL
  is_primary BOOLEAN DEFAULT false, -- 대표 사진 여부
  sort_order INTEGER DEFAULT 0,
  uploaded_by VARCHAR(255), -- 업로드한 사용자
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 투어 코스 포인트 테이블 생성 (여러 포인트 관리용)
CREATE TABLE IF NOT EXISTS tour_course_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  point_name VARCHAR(255) NOT NULL, -- 포인트 이름
  location VARCHAR(255), -- 위치 정보
  latitude DECIMAL(10, 8), -- 위도
  longitude DECIMAL(11, 8), -- 경도
  description_ko TEXT, -- 한국어 설명
  description_en TEXT, -- 영어 설명
  visit_duration INTEGER DEFAULT 60, -- 평균 체류 시간 (분)
  sort_order INTEGER DEFAULT 0, -- 순서
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_course_categories_active ON tour_course_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_course_categories_sort ON tour_course_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_primary ON tour_course_photos(is_primary);
CREATE INDEX IF NOT EXISTS idx_tour_course_points_course_id ON tour_course_points(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_points_sort ON tour_course_points(sort_order);

-- 6. RLS 정책 설정
ALTER TABLE tour_course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_course_points ENABLE ROW LEVEL SECURITY;

-- 팀 기반 RLS 정책 생성
CREATE POLICY "팀은 투어 코스 카테고리를 볼 수 있음" ON tour_course_categories
  FOR SELECT USING (true);

CREATE POLICY "팀은 투어 코스 카테고리를 수정할 수 있음" ON tour_course_categories
  FOR ALL USING (true);

CREATE POLICY "팀은 투어 코스 사진을 볼 수 있음" ON tour_course_photos
  FOR SELECT USING (true);

CREATE POLICY "팀은 투어 코스 사진을 관리할 수 있음" ON tour_course_photos
  FOR ALL USING (true);

CREATE POLICY "팀은 투어 코스 포인트를 볼 수 있음" ON tour_course_points
  FOR SELECT USING (true);

CREATE POLICY "팀은 투어 코스 포인트를 관리할 수 있음" ON tour_course_points
  FOR ALL USING (true);

-- 7. 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 적용
CREATE TRIGGER update_tour_course_categories_updated_at 
  BEFORE UPDATE ON tour_course_categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tour_course_photos_updated_at 
  BEFORE UPDATE ON tour_course_photos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tour_course_points_updated_at 
  BEFORE UPDATE ON tour_course_points 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 스토리지 버킷 생성 (투어 코스 사진용)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tour-course-photos', 'tour-course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 9. 스토리지 정책 설정
CREATE POLICY "팀은 투어 코스 사진을 업로드할 수 있음" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tour-course-photos');

CREATE POLICY "팀은 투어 코스 사진을 볼 수 있음" ON storage.objects
  FOR SELECT USING (bucket_id = 'tour-course-photos');

CREATE POLICY "팀은 투어 코스 사진을 수정할 수 있음" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tour-course-photos');

CREATE POLICY "팀은 투어 코스 사진을 삭제할 수 있음" ON storage.objects
  FOR DELETE USING (bucket_id = 'tour-course-photos');

-- 완료 메시지
SELECT '투어 코스 관리 스키마 업데이트가 완료되었습니다.' as message;
