-- 투어 자료 관리 시스템을 위한 데이터베이스 스키마
-- 가이드가 사용할 투어 자료들을 관리하는 시스템

-- 1. 관광지 테이블 (투어 코스의 각 관광지)
CREATE TABLE IF NOT EXISTS tour_attractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  location VARCHAR(255), -- 위치 정보
  coordinates POINT, -- 위도/경도 좌표
  category VARCHAR(100), -- 관광지 카테고리 (문화재, 자연, 체험 등)
  visit_duration INTEGER DEFAULT 60, -- 평균 체류 시간 (분)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 투어 자료 카테고리 테이블
CREATE TABLE IF NOT EXISTS tour_material_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  icon VARCHAR(50) DEFAULT 'file-text', -- Lucide 아이콘 이름
  color VARCHAR(7) DEFAULT '#3B82F6', -- 카테고리 색상
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 투어 자료 테이블
CREATE TABLE IF NOT EXISTS tour_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  attraction_id UUID REFERENCES tour_attractions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES tour_material_categories(id) ON DELETE SET NULL,
  
  -- 파일 정보
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- script, audio, video, image
  mime_type VARCHAR(100) NOT NULL,
  
  -- 메타데이터
  duration INTEGER, -- 오디오/영상 파일의 재생 시간 (초)
  language VARCHAR(10) DEFAULT 'ko', -- 언어 (ko, en, ja, zh)
  tags TEXT[], -- 태그 배열
  
  -- 권한 및 상태
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true, -- 모든 가이드가 볼 수 있는지 여부
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 감사 로그
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 가이드 퀴즈 테이블
CREATE TABLE IF NOT EXISTS guide_quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  attraction_id UUID REFERENCES tour_attractions(id) ON DELETE CASCADE,
  
  -- 퀴즈 내용
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- 선택지 배열
  correct_answer INTEGER NOT NULL, -- 정답 인덱스 (0부터 시작)
  explanation TEXT, -- 정답 설명
  
  -- 메타데이터
  difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
  language VARCHAR(10) DEFAULT 'ko',
  tags TEXT[],
  
  -- 권한 및 상태
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 감사 로그
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 가이드 퀴즈 결과 테이블
CREATE TABLE IF NOT EXISTS guide_quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES guide_quizzes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 퀴즈 결과
  selected_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken INTEGER, -- 소요 시간 (초)
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(quiz_id, user_id, created_at) -- 같은 퀴즈를 여러 번 풀 수 있도록 시간 포함
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_materials_attraction ON tour_materials(attraction_id);
CREATE INDEX IF NOT EXISTS idx_tour_materials_category ON tour_materials(category_id);
CREATE INDEX IF NOT EXISTS idx_tour_materials_file_type ON tour_materials(file_type);
CREATE INDEX IF NOT EXISTS idx_tour_materials_language ON tour_materials(language);
CREATE INDEX IF NOT EXISTS idx_guide_quizzes_attraction ON guide_quizzes(attraction_id);
CREATE INDEX IF NOT EXISTS idx_guide_quiz_results_quiz ON guide_quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_guide_quiz_results_user ON guide_quiz_results(user_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE tour_attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_quiz_results ENABLE ROW LEVEL SECURITY;

-- 관광지 테이블 RLS 정책
CREATE POLICY "관광지는 모든 인증된 사용자가 읽을 수 있음" ON tour_attractions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "관광지는 관리자만 수정할 수 있음" ON tour_attractions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 투어 자료 카테고리 테이블 RLS 정책
CREATE POLICY "투어 자료 카테고리는 모든 인증된 사용자가 읽을 수 있음" ON tour_material_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "투어 자료 카테고리는 관리자만 수정할 수 있음" ON tour_material_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 투어 자료 테이블 RLS 정책
CREATE POLICY "투어 자료는 모든 인증된 사용자가 읽을 수 있음" ON tour_materials
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "투어 자료는 관리자만 수정할 수 있음" ON tour_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 가이드 퀴즈 테이블 RLS 정책
CREATE POLICY "가이드 퀴즈는 모든 인증된 사용자가 읽을 수 있음" ON guide_quizzes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "가이드 퀴즈는 관리자만 수정할 수 있음" ON guide_quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 가이드 퀴즈 결과 테이블 RLS 정책
CREATE POLICY "가이드 퀴즈 결과는 본인 것만 읽을 수 있음" ON guide_quiz_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "가이드 퀴즈 결과는 본인이 생성할 수 있음" ON guide_quiz_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 기본 데이터 삽입
INSERT INTO tour_material_categories (name_ko, name_en, description_ko, description_en, icon, color, sort_order) VALUES
('가이드 스크립트', 'Guide Scripts', '가이드가 손님에게 안내할 내용을 정리한 스크립트', 'Scripts for guides to provide information to customers', 'file-text', '#3B82F6', 1),
('나레이션 오디오', 'Narration Audio', '관광지 설명을 위한 나레이션 오디오 파일', 'Narration audio files for attraction descriptions', 'volume-2', '#10B981', 2),
('영상 자료', 'Video Materials', '관광지 소개 및 설명 영상', 'Video materials for attraction introductions and descriptions', 'video', '#F59E0B', 3),
('이미지 자료', 'Image Materials', '관광지 사진 및 관련 이미지', 'Photos and related images of attractions', 'image', '#8B5CF6', 4),
('퀴즈 문제', 'Quiz Questions', '가이드 퀴즈 문제 및 정답', 'Quiz questions and answers for guides', 'help-circle', '#EF4444', 5);

-- 샘플 관광지 데이터 삽입
INSERT INTO tour_attractions (name_ko, name_en, description_ko, description_en, location, category, visit_duration) VALUES
('경복궁', 'Gyeongbokgung Palace', '조선왕조의 대표적인 궁궐', 'Representative palace of the Joseon Dynasty', '서울특별시 종로구', '문화재', 90),
('남산타워', 'Namsan Tower', '서울의 대표적인 전망대', 'Representative observatory of Seoul', '서울특별시 용산구', '전망대', 60),
('인사동', 'Insadong', '전통문화가 살아있는 거리', 'Street where traditional culture lives', '서울특별시 종로구', '쇼핑', 120),
('청계천', 'Cheonggyecheon Stream', '도심 속 자연 친화적 공간', 'Nature-friendly space in the city center', '서울특별시 중구', '자연', 45),
('북촌한옥마을', 'Bukchon Hanok Village', '전통 한옥이 보존된 마을', 'Village where traditional hanok houses are preserved', '서울특별시 종로구', '문화재', 90);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 생성
CREATE TRIGGER update_tour_attractions_updated_at BEFORE UPDATE ON tour_attractions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tour_material_categories_updated_at BEFORE UPDATE ON tour_material_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tour_materials_updated_at BEFORE UPDATE ON tour_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guide_quizzes_updated_at BEFORE UPDATE ON guide_quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
