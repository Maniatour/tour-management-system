-- Create tour_bonuses table for storing bonus information
-- Migration: 20250212000000_create_tour_bonuses_table.sql

begin;

-- 투어 보너스 테이블 생성
CREATE TABLE IF NOT EXISTS tour_bonuses (
  tour_id TEXT PRIMARY KEY REFERENCES tours(id) ON DELETE CASCADE,
  guide_bonus DECIMAL(10,2) DEFAULT 0,
  driver_bonus DECIMAL(10,2) DEFAULT 0,
  guide_email TEXT,
  driver_email TEXT,
  additional_cost DECIMAL(10,2) DEFAULT 0,
  non_resident_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_bonuses_tour_id ON tour_bonuses(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_bonuses_guide_email ON tour_bonuses(guide_email);
CREATE INDEX IF NOT EXISTS idx_tour_bonuses_driver_email ON tour_bonuses(driver_email);

-- RLS 정책 설정
ALTER TABLE tour_bonuses ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능
CREATE POLICY "Allow all access to tour_bonuses" ON tour_bonuses FOR ALL USING (true);

commit;
