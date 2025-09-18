-- 프로젝트 테이블 생성
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  assigned_to TEXT[],
  tags TEXT[],
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 이슈 테이블 생성
CREATE TABLE IF NOT EXISTS issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'feature', 'task', 'improvement')),
  assigned_to TEXT,
  reported_by TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- 프로젝트 RLS 정책
CREATE POLICY "프로젝트 조회 권한" ON projects
  FOR SELECT USING (
    created_by = auth.jwt() ->> 'email' OR
    assigned_to @> ARRAY[auth.jwt() ->> 'email'] OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

CREATE POLICY "프로젝트 생성 권한" ON projects
  FOR INSERT WITH CHECK (
    created_by = auth.jwt() ->> 'email' AND
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager', 'team_member')
    )
  );

CREATE POLICY "프로젝트 수정 권한" ON projects
  FOR UPDATE USING (
    created_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

CREATE POLICY "프로젝트 삭제 권한" ON projects
  FOR DELETE USING (
    created_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

-- 이슈 RLS 정책
CREATE POLICY "이슈 조회 권한" ON issues
  FOR SELECT USING (
    reported_by = auth.jwt() ->> 'email' OR
    assigned_to = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

CREATE POLICY "이슈 생성 권한" ON issues
  FOR INSERT WITH CHECK (
    reported_by = auth.jwt() ->> 'email' AND
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager', 'team_member')
    )
  );

CREATE POLICY "이슈 수정 권한" ON issues
  FOR UPDATE USING (
    reported_by = auth.jwt() ->> 'email' OR
    assigned_to = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

CREATE POLICY "이슈 삭제 권한" ON issues
  FOR DELETE USING (
    reported_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE email = auth.jwt() ->> 'email' 
      AND is_active = true 
      AND position IN ('admin', 'manager')
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects USING GIN(assigned_to);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
