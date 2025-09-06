-- Remove event_date column from tour_hotel_bookings table
-- Migration: 20250101000072_remove_event_date_from_tour_hotel_bookings

-- 투어 호텔 부킹 테이블에서 event_date 컬럼 제거
-- 투어를 선택하면 해당 투어의 이벤트 날짜를 자동으로 가져올 수 있으므로 불필요

ALTER TABLE tour_hotel_bookings
DROP COLUMN IF EXISTS event_date;
