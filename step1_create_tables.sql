-- 1단계: 기본 테이블 생성
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'file-text',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  issue_date DATE,
  expiry_date DATE,
  auto_calculate_expiry BOOLEAN DEFAULT false,
  validity_period_months INTEGER DEFAULT 12,
  reminder_30_days BOOLEAN DEFAULT true,
  reminder_7_days BOOLEAN DEFAULT true,
  reminder_expired BOOLEAN DEFAULT true,
  tags TEXT[],
  version VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL,
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_email VARCHAR(255),
  sent_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_type VARCHAR(20) NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, user_id, permission_type)
);

CREATE TABLE IF NOT EXISTS document_download_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
