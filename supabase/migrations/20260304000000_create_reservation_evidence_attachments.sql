-- 예약별 증거 자료(이미지/파일) 저장 테이블
-- 미국 거주자·패스 보유 등 관련 증거 사진/캡처 보관용
-- 작성일: 2026-03-04

CREATE TABLE IF NOT EXISTS reservation_evidence_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_evidence_attachments_reservation_id
  ON reservation_evidence_attachments(reservation_id);

COMMENT ON TABLE reservation_evidence_attachments IS '예약별 증거 자료(미국 거주자/패스 보유 등) 이미지·파일';
COMMENT ON COLUMN reservation_evidence_attachments.reservation_id IS '예약 ID';
COMMENT ON COLUMN reservation_evidence_attachments.file_path IS '스토리지 경로 (images 버킷 내)';
COMMENT ON COLUMN reservation_evidence_attachments.file_name IS '원본 파일명';
COMMENT ON COLUMN reservation_evidence_attachments.image_url IS '공개 URL (조회/표시용)';
