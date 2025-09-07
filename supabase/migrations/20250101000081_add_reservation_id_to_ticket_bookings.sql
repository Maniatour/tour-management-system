-- ticket_bookings 테이블에 reservation_id 컬럼 추가
ALTER TABLE ticket_bookings 
ADD COLUMN IF NOT EXISTS reservation_id TEXT;

-- reservations 테이블과의 외래키 관계 설정
ALTER TABLE ticket_bookings 
ADD CONSTRAINT ticket_bookings_reservation_id_fkey 
FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

-- reservation_id에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_reservation_id 
ON ticket_bookings(reservation_id);
