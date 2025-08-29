-- Update team table structure
-- Make email the primary key, remove unnecessary columns, add new columns
-- Make all columns nullable except name_ko, email, phone

-- First, drop the existing team table
DROP TABLE IF EXISTS public.team CASCADE;

-- Create new team table with updated structure
CREATE TABLE IF NOT EXISTS public.team (
    email VARCHAR(255) PRIMARY KEY,
    name_ko VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    position VARCHAR(100),
    languages TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- New columns
    emergency_contact VARCHAR(255),
    date_of_birth DATE,
    ssn VARCHAR(50),
    personal_car_model VARCHAR(255),
    car_year INTEGER,
    car_plate VARCHAR(50),
    bank_name VARCHAR(255),
    account_holder VARCHAR(255),
    bank_number VARCHAR(255),
    routing_number VARCHAR(255),
    cpr BOOLEAN DEFAULT false,
    cpr_acquired DATE,
    cpr_expired DATE,
    medical_report BOOLEAN DEFAULT false,
    medical_acquired DATE,
    medical_expired DATE
);

-- Add comments
COMMENT ON TABLE team IS '팀원 관리 테이블 (이메일 기반)';
COMMENT ON COLUMN team.email IS '이메일 (기본키, 필수)';
COMMENT ON COLUMN team.name_ko IS '한국어 이름 (필수)';
COMMENT ON COLUMN team.phone IS '전화번호 (필수)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_name_ko ON team(name_ko);
CREATE INDEX IF NOT EXISTS idx_team_position ON team(position);
CREATE INDEX IF NOT EXISTS idx_team_status ON team(status);
CREATE INDEX IF NOT EXISTS idx_team_is_active ON team(is_active);
CREATE INDEX IF NOT EXISTS idx_team_hire_date ON team(hire_date);

-- Insert sample data
INSERT INTO team (email, name_ko, name_en, phone, position, languages, is_active) VALUES
('guide@tour.com', '김가이드', 'Kim Guide', '010-1234-5678', '투어 가이드', ARRAY['ko', 'en'], true),
('manager@tour.com', '박매니저', 'Park Manager', '010-2345-6789', '팀 매니저', ARRAY['ko', 'en'], true),
('driver@tour.com', '이드라이버', 'Lee Driver', '010-3456-7890', '전용 운전기사', ARRAY['ko'], true);
