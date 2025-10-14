-- 상담 관리 시스템을 위한 데이터베이스 스키마
-- FAQ 템플릿과 상담 안내를 관리하는 시스템

-- 1. 상담 템플릿 카테고리 테이블
CREATE TABLE IF NOT EXISTS consultation_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  icon VARCHAR(50) DEFAULT 'message-circle', -- Lucide 아이콘 이름
  color VARCHAR(7) DEFAULT '#3B82F6', -- 카테고리 색상
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 상담 템플릿 테이블 (FAQ)
CREATE TABLE IF NOT EXISTS consultation_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES consultation_categories(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE, -- 특정 상품에만 적용
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE, -- 특정 채널에만 적용
  
  -- 다국어 지원
  question_ko VARCHAR(500) NOT NULL,
  question_en VARCHAR(500) NOT NULL,
  answer_ko TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  
  -- 템플릿 설정
  template_type VARCHAR(50) DEFAULT 'faq' CHECK (template_type IN ('faq', 'greeting', 'closing', 'policy', 'general')),
  priority INTEGER DEFAULT 0, -- 우선순위 (높을수록 먼저 표시)
  
  -- 상태 관리
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false, -- 즐겨찾기
  
  -- 사용 통계
  usage_count INTEGER DEFAULT 0, -- 사용 횟수
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- 메타데이터
  tags TEXT[], -- 태그 배열
  created_by VARCHAR(255), -- 생성자
  updated_by VARCHAR(255), -- 수정자
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 상담 로그 테이블 (상담 기록)
CREATE TABLE IF NOT EXISTS consultation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  
  -- 상담 정보
  consultation_type VARCHAR(50) DEFAULT 'inquiry' CHECK (consultation_type IN ('inquiry', 'complaint', 'booking', 'support', 'other')),
  language VARCHAR(10) DEFAULT 'ko',
  
  -- 상담 내용
  customer_message TEXT,
  agent_response TEXT,
  templates_used UUID[] DEFAULT '{}', -- 사용된 템플릿 ID 배열
  
  -- 상담 결과
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed', 'escalated')),
  resolution TEXT, -- 해결 방법
  
  -- 상담원 정보
  agent_name VARCHAR(255),
  agent_email VARCHAR(255),
  
  -- 시간 정보
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- 상담 소요 시간 (분)
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 상담 통계 테이블 (일별/월별 통계)
CREATE TABLE IF NOT EXISTS consultation_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  
  -- 통계 데이터
  total_inquiries INTEGER DEFAULT 0,
  resolved_inquiries INTEGER DEFAULT 0,
  avg_response_time_minutes DECIMAL(10,2) DEFAULT 0,
  avg_duration_minutes DECIMAL(10,2) DEFAULT 0,
  
  -- 템플릿 사용 통계
  template_usage_count INTEGER DEFAULT 0,
  most_used_template_id UUID REFERENCES consultation_templates(id) ON DELETE SET NULL,
  
  -- 만족도 (추후 확장 가능)
  satisfaction_score DECIMAL(3,2), -- 0.00 ~ 5.00
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, product_id, channel_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultation_templates_category ON consultation_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_product ON consultation_templates(product_id);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_channel ON consultation_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_active ON consultation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_favorite ON consultation_templates(is_favorite);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_type ON consultation_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_consultation_templates_priority ON consultation_templates(priority DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_logs_customer ON consultation_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_product ON consultation_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_channel ON consultation_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_status ON consultation_logs(status);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_date ON consultation_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_consultation_stats_date ON consultation_stats(date);
CREATE INDEX IF NOT EXISTS idx_consultation_stats_product ON consultation_stats(product_id);
CREATE INDEX IF NOT EXISTS idx_consultation_stats_channel ON consultation_stats(channel_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE consultation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_stats ENABLE ROW LEVEL SECURITY;

-- 팀 기반 접근 정책 (기존 시스템과 일관성 유지)
CREATE POLICY "consultation_categories_team_access" ON consultation_categories
  FOR ALL USING (true); -- 모든 사용자가 접근 가능

CREATE POLICY "consultation_templates_team_access" ON consultation_templates
  FOR ALL USING (true); -- 모든 사용자가 접근 가능

CREATE POLICY "consultation_logs_team_access" ON consultation_logs
  FOR ALL USING (true); -- 모든 사용자가 접근 가능

CREATE POLICY "consultation_stats_team_access" ON consultation_stats
  FOR ALL USING (true); -- 모든 사용자가 접근 가능

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_consultation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_consultation_categories_updated_at
  BEFORE UPDATE ON consultation_categories
  FOR EACH ROW EXECUTE FUNCTION update_consultation_updated_at();

CREATE TRIGGER update_consultation_templates_updated_at
  BEFORE UPDATE ON consultation_templates
  FOR EACH ROW EXECUTE FUNCTION update_consultation_updated_at();

CREATE TRIGGER update_consultation_logs_updated_at
  BEFORE UPDATE ON consultation_logs
  FOR EACH ROW EXECUTE FUNCTION update_consultation_updated_at();

CREATE TRIGGER update_consultation_stats_updated_at
  BEFORE UPDATE ON consultation_stats
  FOR EACH ROW EXECUTE FUNCTION update_consultation_updated_at();

-- 템플릿 사용 횟수 업데이트 함수
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE consultation_templates 
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- 샘플 데이터 삽입
INSERT INTO consultation_categories (name_ko, name_en, description_ko, description_en, icon, color, sort_order) VALUES
('일반 문의', 'General Inquiries', '일반적인 문의사항', 'General customer inquiries', 'help-circle', '#3B82F6', 1),
('예약 관련', 'Booking Related', '예약 및 취소 관련 문의', 'Booking and cancellation inquiries', 'calendar', '#10B981', 2),
('가격 문의', 'Pricing Inquiries', '가격 및 결제 관련 문의', 'Pricing and payment inquiries', 'dollar-sign', '#F59E0B', 3),
('투어 정보', 'Tour Information', '투어 상세 정보 문의', 'Detailed tour information inquiries', 'map', '#8B5CF6', 4),
('정책 및 규정', 'Policies & Rules', '취소 정책, 환불 정책 등', 'Cancellation, refund policies, etc.', 'file-text', '#EF4444', 5);

-- 샘플 FAQ 템플릿
INSERT INTO consultation_templates (category_id, question_ko, question_en, answer_ko, answer_en, template_type, priority) VALUES
((SELECT id FROM consultation_categories WHERE name_ko = '일반 문의'), 
 '투어는 몇 명까지 참여할 수 있나요?', 
 'How many people can participate in the tour?',
 '저희 투어는 최대 15명까지 참여 가능합니다. 소그룹 투어로 진행되어 더욱 개인적인 서비스를 제공합니다.',
 'Our tours can accommodate up to 15 people. We operate as small group tours to provide more personalized service.',
 'faq', 10),

((SELECT id FROM consultation_categories WHERE name_ko = '예약 관련'), 
 '예약 취소는 언제까지 가능한가요?', 
 'Until when can I cancel my booking?',
 '투어 시작 24시간 전까지 무료 취소가 가능합니다. 24시간 이내 취소 시에는 취소 수수료가 발생할 수 있습니다.',
 'Free cancellation is available until 24 hours before the tour starts. Cancellation fees may apply for cancellations within 24 hours.',
 'faq', 10),

((SELECT id FROM consultation_categories WHERE name_ko = '가격 문의'), 
 '어린이 요금은 어떻게 되나요?', 
 'What are the children rates?',
 '만 3-12세 어린이는 성인 요금의 70%로 적용됩니다. 만 3세 미만은 무료입니다.',
 'Children aged 3-12 years are charged 70% of the adult rate. Children under 3 years old are free.',
 'faq', 10),

((SELECT id FROM consultation_categories WHERE name_ko = '투어 정보'), 
 '투어에 포함된 것과 포함되지 않은 것은 무엇인가요?', 
 'What is included and not included in the tour?',
 '투어 가격에는 가이드, 교통편, 입장료가 포함되어 있습니다. 식사, 개인 경비, 팁은 별도입니다.',
 'The tour price includes guide, transportation, and entrance fees. Meals, personal expenses, and tips are not included.',
 'faq', 10);

-- 코멘트 추가
COMMENT ON TABLE consultation_categories IS '상담 템플릿 카테고리 관리';
COMMENT ON TABLE consultation_templates IS 'FAQ 및 상담 템플릿 관리';
COMMENT ON TABLE consultation_logs IS '상담 기록 및 로그';
COMMENT ON TABLE consultation_stats IS '상담 통계 데이터';
