-- Create booking tables for tickets and tour hotels
-- Migration: 20250101000070_create_booking_tables

-- 입장권 부킹 테이블
CREATE TABLE IF NOT EXISTS ticket_bookings (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- 카테고리 (예: 앤텔로프 캐니언, 그랜드 캐니언 등)
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 제출일시
    submitted_by VARCHAR(255) NOT NULL, -- 제출자
    check_in_date DATE NOT NULL, -- 체크인 날짜
    time TIME NOT NULL, -- 시간
    company VARCHAR(255) NOT NULL, -- 공급업체
    ea INTEGER NOT NULL DEFAULT 1, -- 수량
    expense DECIMAL(10,2) DEFAULT 0.00, -- 비용
    income DECIMAL(10,2) DEFAULT 0.00, -- 수입
    payment_method VARCHAR(100), -- 결제 방법
    rn_number VARCHAR(255), -- RN#
    tour_id TEXT REFERENCES tours(id), -- 투어 ID
    note TEXT, -- 메모
    status VARCHAR(50) DEFAULT 'pending', -- 상태 (pending, confirmed, cancelled, completed)
    season VARCHAR(100), -- 시즌
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 투어 호텔 부킹 테이블
CREATE TABLE IF NOT EXISTS tour_hotel_bookings (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    tour_id TEXT REFERENCES tours(id), -- 투어 ID
    event_date DATE NOT NULL, -- 이벤트 날짜
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 제출일시
    check_in_date DATE NOT NULL, -- 체크인 날짜
    check_out_date DATE NOT NULL, -- 체크아웃 날짜
    reservation_name VARCHAR(255) NOT NULL, -- 예약명
    cc VARCHAR(255), -- CC (신용카드 정보)
    rooms INTEGER NOT NULL DEFAULT 1, -- 객실 수
    city VARCHAR(255) NOT NULL, -- 도시
    hotel VARCHAR(255) NOT NULL, -- 호텔명
    room_type VARCHAR(255), -- 객실 타입
    unit_price DECIMAL(10,2) DEFAULT 0.00, -- 단가
    total_price DECIMAL(10,2) DEFAULT 0.00, -- 총 가격
    payment_method VARCHAR(100), -- 결제 방법
    website VARCHAR(500), -- 웹사이트
    rn_number VARCHAR(255), -- RN#
    status VARCHAR(50) DEFAULT 'pending', -- 상태 (pending, confirmed, cancelled, completed)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 부킹 히스토리 테이블 (변경 추적용)
CREATE TABLE IF NOT EXISTS booking_history (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    booking_type VARCHAR(50) NOT NULL, -- 'ticket' 또는 'hotel'
    booking_id TEXT NOT NULL, -- 부킹 ID
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'cancelled', 'confirmed'
    old_values JSONB, -- 이전 값들
    new_values JSONB, -- 새로운 값들
    changed_by VARCHAR(255) NOT NULL, -- 변경자
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT -- 변경 사유
);

-- 인덱스 생성
CREATE INDEX idx_ticket_bookings_tour_id ON ticket_bookings(tour_id);
CREATE INDEX idx_ticket_bookings_check_in_date ON ticket_bookings(check_in_date);
CREATE INDEX idx_ticket_bookings_status ON ticket_bookings(status);
CREATE INDEX idx_ticket_bookings_category ON ticket_bookings(category);

CREATE INDEX idx_tour_hotel_bookings_tour_id ON tour_hotel_bookings(tour_id);
CREATE INDEX idx_tour_hotel_bookings_check_in_date ON tour_hotel_bookings(check_in_date);
CREATE INDEX idx_tour_hotel_bookings_status ON tour_hotel_bookings(status);
CREATE INDEX idx_tour_hotel_bookings_hotel ON tour_hotel_bookings(hotel);

CREATE INDEX idx_booking_history_booking_type ON booking_history(booking_type);
CREATE INDEX idx_booking_history_booking_id ON booking_history(booking_id);
CREATE INDEX idx_booking_history_changed_at ON booking_history(changed_at);

-- RLS 활성화
ALTER TABLE ticket_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_hotel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 사용자가 읽기/쓰기 가능)
CREATE POLICY "Enable all access for ticket_bookings" ON ticket_bookings FOR ALL USING (true);
CREATE POLICY "Enable all access for tour_hotel_bookings" ON tour_hotel_bookings FOR ALL USING (true);
CREATE POLICY "Enable all access for booking_history" ON booking_history FOR ALL USING (true);

-- 트리거 함수: 부킹 변경 시 히스토리 기록
CREATE OR REPLACE FUNCTION record_booking_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO booking_history (booking_type, booking_id, action, new_values, changed_by)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            NEW.id,
            'created',
            to_jsonb(NEW),
            COALESCE(NEW.submitted_by, 'system')
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO booking_history (booking_type, booking_id, action, old_values, new_values, changed_by)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            NEW.id,
            'updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            COALESCE(NEW.submitted_by, 'system')
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO booking_history (booking_type, booking_id, action, old_values, changed_by)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'ticket_bookings' THEN 'ticket'
                WHEN TG_TABLE_NAME = 'tour_hotel_bookings' THEN 'hotel'
            END,
            OLD.id,
            'deleted',
            to_jsonb(OLD),
            'system'
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER ticket_bookings_history_trigger
    AFTER INSERT OR UPDATE OR DELETE ON ticket_bookings
    FOR EACH ROW EXECUTE FUNCTION record_booking_history();

CREATE TRIGGER tour_hotel_bookings_history_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tour_hotel_bookings
    FOR EACH ROW EXECUTE FUNCTION record_booking_history();
