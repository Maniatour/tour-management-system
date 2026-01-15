-- Add evidence photo URL column to reservation_reviews table
-- Migration: 20250212000002_add_evidence_photo_to_reservation_reviews.sql

begin;

-- 증거 사진 URL 컬럼 추가
ALTER TABLE reservation_reviews 
ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;

-- 투어 사진 URL 컬럼 추가 (has_photo와 별도로 관리)
ALTER TABLE reservation_reviews 
ADD COLUMN IF NOT EXISTS tour_photo_url TEXT;

commit;
