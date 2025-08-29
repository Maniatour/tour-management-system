-- Create team table for team member management
-- This replaces the employees table with a simpler, more focused structure

-- Drop old employees table if it exists first
DROP TABLE IF EXISTS public.employees CASCADE;

-- Create team table
CREATE TABLE IF NOT EXISTS public.team (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_ko VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    languages TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comments
COMMENT ON TABLE team IS '팀원 관리 테이블';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_email ON team(email);
CREATE INDEX IF NOT EXISTS idx_team_department ON team(department);
CREATE INDEX IF NOT EXISTS idx_team_role ON team(role);
CREATE INDEX IF NOT EXISTS idx_team_status ON team(status);
CREATE INDEX IF NOT EXISTS idx_team_is_active ON team(is_active);

-- Insert sample data
INSERT INTO team (name_ko, name_en, email, phone, position, department, role, languages, skills, bio) VALUES
('김가이드', 'Kim Guide', 'guide@tour.com', '010-1234-5678', '투어 가이드', '투어 운영팀', 'member', ARRAY['ko', 'en'], ARRAY['관광', '영어회화', '문화해설'], '5년 경력의 전문 투어 가이드입니다.'),
('박매니저', 'Park Manager', 'manager@tour.com', '010-2345-6789', '팀 매니저', '투어 운영팀', 'manager', ARRAY['ko', 'en'], ARRAY['관리', '계획수립', '팀리딩'], '투어 운영팀을 이끌고 있는 매니저입니다.'),
('이드라이버', 'Lee Driver', 'driver@tour.com', '010-3456-7890', '전용 운전기사', '운송팀', 'member', ARRAY['ko'], ARRAY['운전', '내비게이션', '고객응대'], '안전 운전을 최우선으로 하는 전문 운전기사입니다.');
