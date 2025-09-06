-- Add submitted_by field to tour_hotel_bookings table
-- Migration: 20250101000073_add_submitted_by_to_tour_hotel_bookings

-- 투어 호텔 부킹 테이블에 submitted_by 필드 추가
ALTER TABLE tour_hotel_bookings
ADD COLUMN submitted_by VARCHAR(255) NOT NULL DEFAULT 'admin@example.com';

-- submitted_by 필드에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_submitted_by ON tour_hotel_bookings(submitted_by);
