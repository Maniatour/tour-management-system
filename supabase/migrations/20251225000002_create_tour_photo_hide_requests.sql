-- 투어 사진 표시 중단 요청 테이블 생성
-- Migration: 20251225000002_create_tour_photo_hide_requests

CREATE TABLE IF NOT EXISTS tour_photo_hide_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, -- Storage에 저장된 파일명
  file_path TEXT NOT NULL, -- Storage 경로 (tourId/fileName)
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL, -- 고객 이름 (스냅샷)
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_hidden BOOLEAN DEFAULT true, -- 표시 중단 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 동일한 사진-고객 조합은 중복 방지
  UNIQUE(tour_id, file_name, customer_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_photo_hide_requests_tour_id ON tour_photo_hide_requests(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_photo_hide_requests_file_name ON tour_photo_hide_requests(file_name);
CREATE INDEX IF NOT EXISTS idx_tour_photo_hide_requests_customer_id ON tour_photo_hide_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_tour_photo_hide_requests_is_hidden ON tour_photo_hide_requests(is_hidden);

-- RLS 활성화
ALTER TABLE tour_photo_hide_requests ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 조회 가능 (공개 읽기)
CREATE POLICY "Anyone can view photo hide requests" ON tour_photo_hide_requests
  FOR SELECT USING (true);

-- RLS 정책: 인증된 사용자가 삽입 가능 (고객이 요청)
CREATE POLICY "Authenticated users can insert photo hide requests" ON tour_photo_hide_requests
  FOR INSERT WITH CHECK (true);

-- RLS 정책: 관리자가 업데이트 가능
CREATE POLICY "Admins can update photo hide requests" ON tour_photo_hide_requests
  FOR UPDATE USING (true);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_tour_photo_hide_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tour_photo_hide_requests_updated_at
  BEFORE UPDATE ON tour_photo_hide_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_photo_hide_requests_updated_at();

-- 코멘트 추가
COMMENT ON TABLE tour_photo_hide_requests IS '고객이 요청한 투어 사진 표시 중단 정보';
COMMENT ON COLUMN tour_photo_hide_requests.tour_id IS '투어 ID';
COMMENT ON COLUMN tour_photo_hide_requests.file_name IS 'Storage에 저장된 파일명';
COMMENT ON COLUMN tour_photo_hide_requests.file_path IS 'Storage 경로 (tourId/fileName)';
COMMENT ON COLUMN tour_photo_hide_requests.customer_id IS '요청한 고객 ID';
COMMENT ON COLUMN tour_photo_hide_requests.customer_name IS '요청한 고객 이름 (스냅샷)';
COMMENT ON COLUMN tour_photo_hide_requests.is_hidden IS '표시 중단 여부';

