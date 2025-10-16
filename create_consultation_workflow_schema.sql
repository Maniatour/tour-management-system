-- 상담 워크플로우 관리 시스템을 위한 데이터베이스 스키마
-- 상담 프로세스를 단계별로 관리하는 시스템

-- 1. 워크플로우 템플릿 테이블
CREATE TABLE IF NOT EXISTS consultation_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  
  -- 워크플로우 설정
  category_id UUID REFERENCES consultation_categories(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  
  -- 워크플로우 상태
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- 기본 워크플로우 여부
  
  -- 메타데이터
  tags TEXT[],
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 워크플로우 단계 테이블
CREATE TABLE IF NOT EXISTS consultation_workflow_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES consultation_workflows(id) ON DELETE CASCADE,
  
  -- 단계 정보
  step_name_ko VARCHAR(200) NOT NULL,
  step_name_en VARCHAR(200) NOT NULL,
  step_description_ko TEXT,
  step_description_en TEXT,
  
  -- 단계 설정
  step_order INTEGER NOT NULL, -- 단계 순서
  step_type VARCHAR(50) DEFAULT 'action' CHECK (step_type IN ('action', 'decision', 'condition', 'template', 'manual')),
  
  -- 액션 설정
  action_type VARCHAR(50), -- 'send_template', 'ask_question', 'wait_response', 'escalate', 'close'
  template_id UUID REFERENCES consultation_templates(id) ON DELETE SET NULL,
  
  -- 조건 설정
  condition_type VARCHAR(50), -- 'customer_response', 'time_elapsed', 'escalation_needed'
  condition_value TEXT, -- 조건 값 (JSON 형태)
  
  -- 다음 단계 설정
  next_step_id UUID REFERENCES consultation_workflow_steps(id) ON DELETE SET NULL,
  alternative_step_id UUID REFERENCES consultation_workflow_steps(id) ON DELETE SET NULL,
  
  -- 시간 설정
  timeout_minutes INTEGER DEFAULT 0, -- 타임아웃 시간 (분)
  
  -- 상태
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT true, -- 필수 단계 여부
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 워크플로우 실행 로그 테이블
CREATE TABLE IF NOT EXISTS consultation_workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES consultation_workflows(id) ON DELETE CASCADE,
  consultation_log_id UUID REFERENCES consultation_logs(id) ON DELETE CASCADE,
  
  -- 실행 정보
  current_step_id UUID REFERENCES consultation_workflow_steps(id) ON DELETE SET NULL,
  execution_status VARCHAR(50) DEFAULT 'running' CHECK (execution_status IN ('running', 'completed', 'paused', 'cancelled', 'failed')),
  
  -- 실행 데이터
  execution_data JSONB DEFAULT '{}', -- 실행 중 데이터 저장
  step_history JSONB DEFAULT '[]', -- 단계별 실행 히스토리
  
  -- 시간 정보
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_step_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 워크플로우 단계 실행 로그 테이블
CREATE TABLE IF NOT EXISTS consultation_workflow_step_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES consultation_workflow_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES consultation_workflow_steps(id) ON DELETE CASCADE,
  
  -- 실행 정보
  step_status VARCHAR(50) DEFAULT 'pending' CHECK (step_status IN ('pending', 'running', 'completed', 'skipped', 'failed')),
  step_result VARCHAR(50), -- 'success', 'failure', 'timeout', 'escalated'
  
  -- 실행 데이터
  input_data JSONB DEFAULT '{}', -- 입력 데이터
  output_data JSONB DEFAULT '{}', -- 출력 데이터
  error_message TEXT, -- 에러 메시지
  
  -- 시간 정보
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, -- 실행 시간 (초)
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultation_workflows_category ON consultation_workflows(category_id);
CREATE INDEX IF NOT EXISTS idx_consultation_workflows_product ON consultation_workflows(product_id);
CREATE INDEX IF NOT EXISTS idx_consultation_workflows_channel ON consultation_workflows(channel_id);
CREATE INDEX IF NOT EXISTS idx_consultation_workflows_active ON consultation_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_consultation_workflows_default ON consultation_workflows(is_default);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON consultation_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON consultation_workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON consultation_workflow_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_active ON consultation_workflow_steps(is_active);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON consultation_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_log ON consultation_workflow_executions(consultation_log_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON consultation_workflow_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON consultation_workflow_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_step_executions_execution ON consultation_workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_step ON consultation_workflow_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_status ON consultation_workflow_step_executions(step_status);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE consultation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_workflow_step_executions ENABLE ROW LEVEL SECURITY;

-- 팀 기반 접근 정책 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "consultation_workflows_team_access" ON consultation_workflows;
CREATE POLICY "consultation_workflows_team_access" ON consultation_workflows
  FOR ALL USING (true);

DROP POLICY IF EXISTS "consultation_workflow_steps_team_access" ON consultation_workflow_steps;
CREATE POLICY "consultation_workflow_steps_team_access" ON consultation_workflow_steps
  FOR ALL USING (true);

DROP POLICY IF EXISTS "consultation_workflow_executions_team_access" ON consultation_workflow_executions;
CREATE POLICY "consultation_workflow_executions_team_access" ON consultation_workflow_executions
  FOR ALL USING (true);

DROP POLICY IF EXISTS "consultation_workflow_step_executions_team_access" ON consultation_workflow_step_executions;
CREATE POLICY "consultation_workflow_step_executions_team_access" ON consultation_workflow_step_executions
  FOR ALL USING (true);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (기존 트리거 삭제 후 재생성)
DROP TRIGGER IF EXISTS update_consultation_workflows_updated_at ON consultation_workflows;
CREATE TRIGGER update_consultation_workflows_updated_at
  BEFORE UPDATE ON consultation_workflows
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS update_consultation_workflow_steps_updated_at ON consultation_workflow_steps;
CREATE TRIGGER update_consultation_workflow_steps_updated_at
  BEFORE UPDATE ON consultation_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS update_consultation_workflow_executions_updated_at ON consultation_workflow_executions;
CREATE TRIGGER update_consultation_workflow_executions_updated_at
  BEFORE UPDATE ON consultation_workflow_executions
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

DROP TRIGGER IF EXISTS update_consultation_workflow_step_executions_updated_at ON consultation_workflow_step_executions;
CREATE TRIGGER update_consultation_workflow_step_executions_updated_at
  BEFORE UPDATE ON consultation_workflow_step_executions
  FOR EACH ROW EXECUTE FUNCTION update_workflow_updated_at();

-- 워크플로우 실행 함수
CREATE OR REPLACE FUNCTION start_workflow_execution(
  p_workflow_id UUID,
  p_consultation_log_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
  v_first_step_id UUID;
BEGIN
  -- 실행 로그 생성
  INSERT INTO consultation_workflow_executions (workflow_id, consultation_log_id)
  VALUES (p_workflow_id, p_consultation_log_id)
  RETURNING id INTO v_execution_id;
  
  -- 첫 번째 단계 찾기
  SELECT id INTO v_first_step_id
  FROM consultation_workflow_steps
  WHERE workflow_id = p_workflow_id
    AND is_active = true
  ORDER BY step_order ASC
  LIMIT 1;
  
  -- 첫 번째 단계 실행 시작
  IF v_first_step_id IS NOT NULL THEN
    UPDATE consultation_workflow_executions
    SET current_step_id = v_first_step_id
    WHERE id = v_execution_id;
    
    -- 첫 번째 단계 실행 로그 생성
    INSERT INTO consultation_workflow_step_executions (execution_id, step_id, step_status)
    VALUES (v_execution_id, v_first_step_id, 'running');
  END IF;
  
  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql;

-- 조건문 평가 함수
CREATE OR REPLACE FUNCTION evaluate_workflow_condition(
  p_step_id UUID,
  p_condition_data JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_step RECORD;
  v_result BOOLEAN := false;
BEGIN
  -- 단계 정보 가져오기
  SELECT * INTO v_step
  FROM consultation_workflow_steps
  WHERE id = p_step_id;
  
  -- 조건 타입별 평가
  CASE v_step.condition_type
    WHEN 'customer_response' THEN
      -- 고객 응답 조건 평가
      v_result := (p_condition_data->>'customer_response') = v_step.condition_value;
      
    WHEN 'time_elapsed' THEN
      -- 시간 경과 조건 평가 (분 단위)
      v_result := EXTRACT(EPOCH FROM (NOW() - (p_condition_data->>'start_time')::timestamp)) / 60 >= (v_step.condition_value)::integer;
      
    WHEN 'product_match' THEN
      -- 상품 매칭 조건 평가
      v_result := (p_condition_data->>'product_id') = v_step.condition_value;
      
    WHEN 'channel_match' THEN
      -- 채널 매칭 조건 평가
      v_result := (p_condition_data->>'channel_id') = v_step.condition_value;
      
    WHEN 'category_match' THEN
      -- 카테고리 매칭 조건 평가
      v_result := (p_condition_data->>'category_id') = v_step.condition_value;
      
    WHEN 'language_preference' THEN
      -- 언어 선호도 조건 평가
      v_result := (p_condition_data->>'language') = v_step.condition_value;
      
    WHEN 'escalation_needed' THEN
      -- 에스컬레이션 필요 조건 평가
      v_result := (p_condition_data->>'escalation_needed')::boolean = (v_step.condition_value)::boolean;
      
    WHEN 'custom_field' THEN
      -- 사용자 정의 필드 조건 평가
      v_result := (p_condition_data->>(v_step.condition_value)) IS NOT NULL;
      
    ELSE
      -- 기본값: false
      v_result := false;
  END CASE;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 워크플로우 단계 완료 함수 (조건문 지원)
CREATE OR REPLACE FUNCTION complete_workflow_step(
  p_execution_id UUID,
  p_step_id UUID,
  p_result VARCHAR(50),
  p_output_data JSONB DEFAULT '{}',
  p_condition_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_next_step_id UUID;
  v_workflow_id UUID;
  v_step RECORD;
  v_condition_result BOOLEAN := true;
BEGIN
  -- 현재 단계 완료 처리
  UPDATE consultation_workflow_step_executions
  SET step_status = 'completed',
      step_result = p_result,
      output_data = p_output_data,
      completed_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
  WHERE execution_id = p_execution_id AND step_id = p_step_id;
  
  -- 워크플로우 ID 가져오기
  SELECT workflow_id INTO v_workflow_id
  FROM consultation_workflow_executions
  WHERE id = p_execution_id;
  
  -- 단계 정보 가져오기
  SELECT * INTO v_step
  FROM consultation_workflow_steps
  WHERE id = p_step_id;
  
  -- 조건문이 있는 경우 평가
  IF v_step.step_type = 'condition' AND v_step.condition_type IS NOT NULL THEN
    v_condition_result := evaluate_workflow_condition(p_step_id, p_condition_data);
  END IF;
  
  -- 다음 단계 결정 (조건문 결과 고려)
  IF p_result = 'success' AND v_condition_result THEN
    SELECT next_step_id INTO v_next_step_id
    FROM consultation_workflow_steps
    WHERE id = p_step_id;
  ELSE
    SELECT alternative_step_id INTO v_next_step_id
    FROM consultation_workflow_steps
    WHERE id = p_step_id;
  END IF;
  
  -- 다음 단계가 있으면 실행
  IF v_next_step_id IS NOT NULL THEN
    UPDATE consultation_workflow_executions
    SET current_step_id = v_next_step_id,
        last_step_at = NOW()
    WHERE id = p_execution_id;
    
    -- 다음 단계 실행 로그 생성
    INSERT INTO consultation_workflow_step_executions (execution_id, step_id, step_status)
    VALUES (p_execution_id, v_next_step_id, 'running');
  ELSE
    -- 워크플로우 완료
    UPDATE consultation_workflow_executions
    SET execution_status = 'completed',
        completed_at = NOW(),
        current_step_id = NULL
    WHERE id = p_execution_id;
  END IF;
  
  RETURN v_next_step_id;
END;
$$ LANGUAGE plpgsql;

-- 샘플 워크플로우 데이터 (중복 방지)
INSERT INTO consultation_workflows (name_ko, name_en, description_ko, description_en, category_id, is_default) 
SELECT '일반 문의 처리 워크플로우', 'General Inquiry Workflow', '일반적인 고객 문의를 처리하는 기본 워크플로우', 'Basic workflow for handling general customer inquiries', 
 (SELECT id FROM consultation_categories WHERE name_ko = '일반 문의'), true
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우');

INSERT INTO consultation_workflows (name_ko, name_en, description_ko, description_en, category_id, is_default) 
SELECT '예약 문의 처리 워크플로우', 'Booking Inquiry Workflow', '예약 관련 문의를 처리하는 워크플로우', 'Workflow for handling booking-related inquiries',
 (SELECT id FROM consultation_categories WHERE name_ko = '예약 관련'), false
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflows WHERE name_ko = '예약 문의 처리 워크플로우');

INSERT INTO consultation_workflows (name_ko, name_en, description_ko, description_en, category_id, is_default) 
SELECT '가격 문의 처리 워크플로우', 'Pricing Inquiry Workflow', '가격 관련 문의를 처리하는 워크플로우', 'Workflow for handling pricing-related inquiries',
 (SELECT id FROM consultation_categories WHERE name_ko = '가격 문의'), false
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflows WHERE name_ko = '가격 문의 처리 워크플로우');

-- 샘플 워크플로우 단계 데이터 (일반 문의 처리 워크플로우) - 중복 방지
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '인사말 전송', 'Send Greeting', '고객에게 인사말을 전송합니다', 'Send greeting message to customer', 1, 'action', 'send_template'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '인사말 전송');

INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '문의 내용 확인', 'Check Inquiry Content', '고객의 문의 내용을 확인합니다', 'Check customer inquiry content', 2, 'action', 'ask_question'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '문의 내용 확인');

INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '적절한 답변 선택', 'Select Appropriate Answer', '문의에 맞는 답변을 선택합니다', 'Select appropriate answer for the inquiry', 3, 'decision', NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '적절한 답변 선택');

INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '답변 전송', 'Send Answer', '선택된 답변을 고객에게 전송합니다', 'Send selected answer to customer', 4, 'action', 'send_template'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '답변 전송');

INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '추가 도움 필요 여부 확인', 'Check Additional Help Needed', '고객이 추가 도움이 필요한지 확인합니다', 'Check if customer needs additional help', 5, 'decision', NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '추가 도움 필요 여부 확인');

INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우'),
 '상담 마무리', 'Close Consultation', '상담을 마무리합니다', 'Close the consultation', 6, 'action', 'close'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '일반 문의 처리 워크플로우') AND step_name_ko = '상담 마무리');

-- 조건문 예시 워크플로우 추가 (중복 방지)
INSERT INTO consultation_workflows (name_ko, name_en, description_ko, description_en, category_id, is_default) 
SELECT '조건문 예시 워크플로우', 'Conditional Workflow Example', '다양한 조건문을 사용하는 예시 워크플로우', 'Example workflow using various conditional statements',
 (SELECT id FROM consultation_categories WHERE name_ko = '일반 문의'), false
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우');

-- 조건문 예시 워크플로우 단계 (중복 방지)
-- 인사말 전송
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '인사말 전송', 'Send Greeting', '고객에게 인사말을 전송합니다', 'Send greeting message to customer', 1, 'action', 'send_template', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '인사말 전송');

-- 언어 확인
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '언어 확인', 'Check Language', '고객의 언어 선호도를 확인합니다', 'Check customer language preference', 2, 'condition', NULL, 'language_preference', 'ko'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '언어 확인');

-- 한국어 응답
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '한국어 응답', 'Korean Response', '한국어로 응답합니다', 'Respond in Korean', 3, 'action', 'send_template', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '한국어 응답');

-- 영어 응답
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '영어 응답', 'English Response', '영어로 응답합니다', 'Respond in English', 4, 'action', 'send_template', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '영어 응답');

-- 상품 매칭 확인
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '상품 매칭 확인', 'Check Product Match', '문의 상품이 특정 상품과 매칭되는지 확인합니다', 'Check if inquiry matches specific product', 5, 'condition', NULL, 'product_match', 'MDGCSUNRISE'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '상품 매칭 확인');

-- 특별 상품 안내
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '특별 상품 안내', 'Special Product Guide', '특별 상품에 대한 안내를 제공합니다', 'Provide special product information', 6, 'action', 'send_template', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '특별 상품 안내');

-- 일반 상품 안내
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '일반 상품 안내', 'General Product Guide', '일반 상품에 대한 안내를 제공합니다', 'Provide general product information', 7, 'action', 'send_template', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '일반 상품 안내');

-- 시간 경과 확인
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '시간 경과 확인', 'Check Time Elapsed', '상담 시간이 30분을 초과했는지 확인합니다', 'Check if consultation time exceeds 30 minutes', 8, 'condition', NULL, 'time_elapsed', '30'
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '시간 경과 확인');

-- 에스컬레이션
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '에스컬레이션', 'Escalation', '상급자에게 상담을 이관합니다', 'Escalate consultation to supervisor', 9, 'action', 'escalate', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '에스컬레이션');

-- 상담 마무리
INSERT INTO consultation_workflow_steps (workflow_id, step_name_ko, step_name_en, step_description_ko, step_description_en, step_order, step_type, action_type, condition_type, condition_value) 
SELECT (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우'),
 '상담 마무리', 'Close Consultation', '상담을 마무리합니다', 'Close the consultation', 10, 'action', 'close', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM consultation_workflow_steps WHERE workflow_id = (SELECT id FROM consultation_workflows WHERE name_ko = '조건문 예시 워크플로우') AND step_name_ko = '상담 마무리');

-- 코멘트 추가
COMMENT ON TABLE consultation_workflows IS '상담 워크플로우 템플릿 관리';
COMMENT ON TABLE consultation_workflow_steps IS '워크플로우 단계 정의';
COMMENT ON TABLE consultation_workflow_executions IS '워크플로우 실행 로그';
COMMENT ON TABLE consultation_workflow_step_executions IS '워크플로우 단계별 실행 로그';
