-- reservation_options 테이블 생성
-- 예약에 선택된 옵션들을 저장하는 테이블

CREATE TABLE IF NOT EXISTS reservation_options (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    ea INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'refunded')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservation_options_reservation_id ON reservation_options(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_option_id ON reservation_options(option_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_status ON reservation_options(status);

-- RLS (Row Level Security) 활성화
ALTER TABLE reservation_options ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
-- 모든 사용자가 읽기 가능
CREATE POLICY "reservation_options_select_policy" ON reservation_options
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "reservation_options_insert_policy" ON reservation_options
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "reservation_options_update_policy" ON reservation_options
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "reservation_options_delete_policy" ON reservation_options
    FOR DELETE USING (auth.role() = 'authenticated');

-- updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_reservation_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER trigger_update_reservation_options_updated_at
    BEFORE UPDATE ON reservation_options
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_options_updated_at();

-- total_price 자동 계산을 위한 트리거 함수
CREATE OR REPLACE FUNCTION calculate_reservation_options_total_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.ea * NEW.price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- total_price 자동 계산 트리거 생성
CREATE TRIGGER trigger_calculate_reservation_options_total_price
    BEFORE INSERT OR UPDATE ON reservation_options
    FOR EACH ROW
    EXECUTE FUNCTION calculate_reservation_options_total_price();

-- 테이블 코멘트 추가
COMMENT ON TABLE reservation_options IS '예약에 선택된 옵션들을 저장하는 테이블';
COMMENT ON COLUMN reservation_options.id IS '고유 식별자 (TEXT 타입)';
COMMENT ON COLUMN reservation_options.reservation_id IS '예약 ID (reservations 테이블 참조)';
COMMENT ON COLUMN reservation_options.option_id IS '옵션 ID';
COMMENT ON COLUMN reservation_options.ea IS '수량';
COMMENT ON COLUMN reservation_options.price IS '단가';
COMMENT ON COLUMN reservation_options.total_price IS '총 가격 (ea * price)';
COMMENT ON COLUMN reservation_options.status IS '상태 (active, cancelled, refunded)';
COMMENT ON COLUMN reservation_options.note IS '메모';
COMMENT ON COLUMN reservation_options.created_at IS '생성일시';
COMMENT ON COLUMN reservation_options.updated_at IS '수정일시';

