-- Make tour_id nullable in booking tables
-- Migration: 20250101000071_make_tour_id_nullable

-- 입장권 부킹 테이블의 tour_id를 nullable로 변경
ALTER TABLE ticket_bookings 
ALTER COLUMN tour_id DROP NOT NULL;

-- 투어 호텔 부킹 테이블의 tour_id를 nullable로 변경  
ALTER TABLE tour_hotel_bookings 
ALTER COLUMN tour_id DROP NOT NULL;

-- 외래키 제약조건을 ON DELETE SET NULL로 변경
ALTER TABLE ticket_bookings 
DROP CONSTRAINT IF EXISTS ticket_bookings_tour_id_fkey;

ALTER TABLE ticket_bookings 
ADD CONSTRAINT ticket_bookings_tour_id_fkey 
FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;

ALTER TABLE tour_hotel_bookings 
DROP CONSTRAINT IF EXISTS tour_hotel_bookings_tour_id_fkey;

ALTER TABLE tour_hotel_bookings 
ADD CONSTRAINT tour_hotel_bookings_tour_id_fkey 
FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
