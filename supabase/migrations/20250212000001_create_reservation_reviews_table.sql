-- Create reservation_reviews table for storing customer reviews
-- Migration: 20250212000001_create_reservation_reviews_table.sql

begin;

-- 예약 후기 테이블 생성
CREATE TABLE IF NOT EXISTS reservation_reviews (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL, -- 구글, 예약자의 채널 등
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 별점 1~5
  content TEXT, -- 후기 내용 (장문의 텍스트)
  has_photo BOOLEAN DEFAULT false, -- 사진 첨부 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 같은 예약에 같은 플랫폼에 여러 후기를 남길 수 없도록 제약조건 추가하지 않음
  -- (1인 예약이어도 여러 플랫폼에 후기를 남길 수 있음)
  UNIQUE(reservation_id, platform, created_at) -- 같은 예약, 같은 플랫폼, 같은 시간에 중복 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservation_reviews_reservation_id ON reservation_reviews(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_reviews_platform ON reservation_reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reservation_reviews_rating ON reservation_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reservation_reviews_created_at ON reservation_reviews(created_at);

-- RLS 정책 설정
ALTER TABLE reservation_reviews ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능
CREATE POLICY "Allow all access to reservation_reviews" ON reservation_reviews FOR ALL USING (true);

commit;
