-- 문서 관리 시스템을 위한 데이터베이스 스키마
-- 여행사 전용 회사 문서 관리 시스템

-- 1. 문서 카테고리 테이블
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6', -- 카테고리 색상 (HEX)
  icon VARCHAR(50) DEFAULT 'file-text', -- Lucide 아이콘 이름
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 문서 테이블
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- 만료일 관련 필드
  issue_date DATE, -- 발급일
  expiry_date DATE, -- 만료일
  auto_calculate_expiry BOOLEAN DEFAULT false, -- 자동 만료일 계산 여부
  validity_period_months INTEGER DEFAULT 12, -- 유효기간 (개월)
  
  -- 알림 설정
  reminder_30_days BOOLEAN DEFAULT true, -- 30일 전 알림
  reminder_7_days BOOLEAN DEFAULT true,  -- 7일 전 알림
  reminder_expired BOOLEAN DEFAULT true, -- 만료일 당일 알림
  
  -- 메타데이터
  tags TEXT[], -- 태그 배열
  version VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(20) DEFAULT 'active', -- active, expired, archived
  
  -- 권한 및 소유자
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 감사 로그
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 문서 알림 로그 테이블
CREATE TABLE IF NOT EXISTS document_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL, -- '30_days', '7_days', 'expired'
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_email VARCHAR(255),
  sent_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 문서 접근 권한 테이블
CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_type VARCHAR(20) NOT NULL, -- 'view', 'edit', 'delete'
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, user_id, permission_type)
);

-- 5. 문서 다운로드 로그 테이블
CREATE TABLE IF NOT EXISTS document_download_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_title_search ON documents USING GIN(to_tsvector('simple', title || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_document_reminders_document_id ON document_reminders(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_reminder_date ON document_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_document_reminders_status ON document_reminders(status);

CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id ON document_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_document_download_logs_document_id ON document_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_download_logs_user_id ON document_download_logs(user_id);

-- 기본 카테고리 데이터 삽입
INSERT INTO document_categories (name_ko, name_en, description_ko, description_en, color, icon, sort_order) VALUES
('계약/협약', 'Contracts/Agreements', '호텔 계약서, 제휴사 계약, 가이드 계약 등', 'Hotel contracts, partnership agreements, guide contracts, etc.', '#3B82F6', 'file-signature', 1),
('보험/보증', 'Insurance/Bonds', '여행자 보험, 차량 보험, 영업 보증서 등', 'Travel insurance, vehicle insurance, business bonds, etc.', '#10B981', 'shield-check', 2),
('운송 관련', 'Transportation', '차량 등록증, 운전면허, 정기 점검 기록 등', 'Vehicle registration, driver license, inspection records, etc.', '#F59E0B', 'truck', 3),
('비자/허가증', 'Visas/Permits', '영업허가증, 사업자 등록증, 해외 비자 관련 서류 등', 'Business permits, business registration, overseas visa documents, etc.', '#8B5CF6', 'id-card', 4),
('회계/세무', 'Accounting/Tax', '세금 신고서, 납부 영수증, 회계감사 서류 등', 'Tax returns, payment receipts, audit documents, etc.', '#EF4444', 'calculator', 5),
('기타', 'Others', '내부 규정, 직원 교육 자료, 안전 매뉴얼 등', 'Internal regulations, employee training materials, safety manuals, etc.', '#6B7280', 'folder', 6)
ON CONFLICT DO NOTHING;

-- RLS (Row Level Security) 정책 설정
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_download_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 문서에 접근 가능
CREATE POLICY "Admins can access all documents" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 일반 사용자는 자신이 생성한 문서와 권한이 있는 문서에만 접근 가능
CREATE POLICY "Users can access their own documents" ON documents
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM document_permissions dp
      WHERE dp.document_id = documents.id
      AND dp.user_id = auth.uid()
      AND dp.permission_type IN ('view', 'edit', 'delete')
    )
  );

-- 카테고리는 모든 인증된 사용자가 조회 가능
CREATE POLICY "Authenticated users can view categories" ON document_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자는 카테고리 관리 가능
CREATE POLICY "Admins can manage categories" ON document_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 문서 권한 테이블 정책
CREATE POLICY "Users can view their permissions" ON document_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage permissions" ON document_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 문서 알림 로그 정책
CREATE POLICY "Users can view their reminders" ON document_reminders
  FOR SELECT USING (
    sent_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_reminders.document_id
      AND d.created_by = auth.uid()
    )
  );

-- 다운로드 로그 정책
CREATE POLICY "Users can view their download logs" ON document_download_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all download logs" ON document_download_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.email IN (
        SELECT email FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- 함수: 만료일 자동 계산
CREATE OR REPLACE FUNCTION calculate_expiry_date(
  issue_date DATE,
  validity_period_months INTEGER DEFAULT 12
) RETURNS DATE AS $$
BEGIN
  IF issue_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN issue_date + INTERVAL '1 month' * validity_period_months;
END;
$$ LANGUAGE plpgsql;

-- 함수: 문서 상태 업데이트 (만료일 기준)
CREATE OR REPLACE FUNCTION update_document_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 만료일이 있고 오늘 날짜보다 이전이면 상태를 'expired'로 변경
  IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  -- 만료일이 없거나 미래이면 상태를 'active'로 변경
  ELSIF NEW.expiry_date IS NULL OR NEW.expiry_date >= CURRENT_DATE THEN
    NEW.status := 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 문서 상태 자동 업데이트
CREATE TRIGGER trigger_update_document_status
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_status();

-- 함수: 만료일 자동 계산 트리거
CREATE OR REPLACE FUNCTION auto_calculate_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  -- 자동 계산이 활성화되어 있고 발급일이 있으면 만료일 계산
  IF NEW.auto_calculate_expiry = true AND NEW.issue_date IS NOT NULL THEN
    NEW.expiry_date := calculate_expiry_date(NEW.issue_date, NEW.validity_period_months);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 만료일 자동 계산
CREATE TRIGGER trigger_auto_calculate_expiry_date
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_expiry_date();

-- 함수: 문서 알림 생성
CREATE OR REPLACE FUNCTION create_document_reminders()
RETURNS TRIGGER AS $$
DECLARE
  reminder_30_date DATE;
  reminder_7_date DATE;
BEGIN
  -- 만료일이 있는 경우에만 알림 생성
  IF NEW.expiry_date IS NOT NULL THEN
    -- 30일 전 알림
    IF NEW.reminder_30_days = true THEN
      reminder_30_date := NEW.expiry_date - INTERVAL '30 days';
      INSERT INTO document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      VALUES (NEW.id, '30_days', reminder_30_date, NEW.created_by);
    END IF;
    
    -- 7일 전 알림
    IF NEW.reminder_7_days = true THEN
      reminder_7_date := NEW.expiry_date - INTERVAL '7 days';
      INSERT INTO document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      VALUES (NEW.id, '7_days', reminder_7_date, NEW.created_by);
    END IF;
    
    -- 만료일 당일 알림
    IF NEW.reminder_expired = true THEN
      INSERT INTO document_reminders (document_id, reminder_type, reminder_date, sent_to_user_id)
      VALUES (NEW.id, 'expired', NEW.expiry_date, NEW.created_by);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 문서 알림 자동 생성
CREATE TRIGGER trigger_create_document_reminders
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION create_document_reminders();

-- Storage 버킷 생성 (문서 파일 저장용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-files',
  'document-files',
  false,
  104857600, -- 100MB 제한
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM documents d
        WHERE d.file_path = name
        AND (
          d.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM document_permissions dp
            WHERE dp.document_id = d.id
            AND dp.user_id = auth.uid()
            AND dp.permission_type IN ('view', 'edit', 'delete')
          )
        )
      )
    )
  );

CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'document-files' AND
    auth.role() = 'authenticated' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 시간 트리거
CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON document_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
