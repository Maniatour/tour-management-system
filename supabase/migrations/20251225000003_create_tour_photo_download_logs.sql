-- 투어 사진 다운로드 기록 테이블 생성
-- Migration: 20251225000003_create_tour_photo_download_logs

CREATE TABLE IF NOT EXISTS tour_photo_download_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, -- Storage에 저장된 파일명
  file_path TEXT NOT NULL, -- Storage 경로 (tourId/fileName)
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL, -- 고객 이름 (스냅샷)
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_photo_download_logs_tour_id ON tour_photo_download_logs(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_photo_download_logs_file_name ON tour_photo_download_logs(file_name);
CREATE INDEX IF NOT EXISTS idx_tour_photo_download_logs_customer_id ON tour_photo_download_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_tour_photo_download_logs_downloaded_at ON tour_photo_download_logs(downloaded_at);

-- RLS 활성화
ALTER TABLE tour_photo_download_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 조회 가능 (공개 읽기)
CREATE POLICY "Anyone can view download logs" ON tour_photo_download_logs
  FOR SELECT USING (true);

-- RLS 정책: 인증된 사용자가 삽입 가능 (고객이 다운로드)
CREATE POLICY "Authenticated users can insert download logs" ON tour_photo_download_logs
  FOR INSERT WITH CHECK (true);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_tour_photo_download_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tour_photo_download_logs_updated_at
  BEFORE UPDATE ON tour_photo_download_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_photo_download_logs_updated_at();

-- 코멘트 추가
COMMENT ON TABLE tour_photo_download_logs IS '고객이 다운로드한 투어 사진 기록';
COMMENT ON COLUMN tour_photo_download_logs.tour_id IS '투어 ID';
COMMENT ON COLUMN tour_photo_download_logs.file_name IS 'Storage에 저장된 파일명';
COMMENT ON COLUMN tour_photo_download_logs.file_path IS 'Storage 경로 (tourId/fileName)';
COMMENT ON COLUMN tour_photo_download_logs.customer_id IS '다운로드한 고객 ID';
COMMENT ON COLUMN tour_photo_download_logs.customer_name IS '다운로드한 고객 이름 (스냅샷)';
COMMENT ON COLUMN tour_photo_download_logs.downloaded_at IS '다운로드 시각';

