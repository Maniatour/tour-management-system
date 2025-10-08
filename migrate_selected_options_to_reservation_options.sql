-- 기존 reservations 테이블의 selected_options 데이터를 reservation_options 테이블로 마이그레이션
-- 이 스크립트는 기존 JSONB 데이터를 정규화된 테이블로 변환합니다.

-- 1. 먼저 reservation_options 테이블이 존재하는지 확인하고 생성
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

-- 2. 누락된 컬럼 추가
ALTER TABLE reservation_options 
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservation_options_reservation_id ON reservation_options(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_option_id ON reservation_options(option_id);
CREATE INDEX IF NOT EXISTS idx_reservation_options_status ON reservation_options(status);

-- 4. RLS 활성화
ALTER TABLE reservation_options ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 생성
DROP POLICY IF EXISTS "reservation_options_select_policy" ON reservation_options;
CREATE POLICY "reservation_options_select_policy" ON reservation_options
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "reservation_options_insert_policy" ON reservation_options;
CREATE POLICY "reservation_options_insert_policy" ON reservation_options
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reservation_options_update_policy" ON reservation_options;
CREATE POLICY "reservation_options_update_policy" ON reservation_options
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "reservation_options_delete_policy" ON reservation_options;
CREATE POLICY "reservation_options_delete_policy" ON reservation_options
    FOR DELETE USING (auth.role() = 'authenticated');

-- 6. total_price 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_reservation_options_total_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.ea * NEW.price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. total_price 자동 계산 트리거
DROP TRIGGER IF EXISTS trigger_calculate_reservation_options_total_price ON reservation_options;
CREATE TRIGGER trigger_calculate_reservation_options_total_price
    BEFORE INSERT OR UPDATE ON reservation_options
    FOR EACH ROW
    EXECUTE FUNCTION calculate_reservation_options_total_price();

-- 8. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_reservation_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. updated_at 트리거
DROP TRIGGER IF EXISTS trigger_update_reservation_options_updated_at ON reservation_options;
CREATE TRIGGER trigger_update_reservation_options_updated_at
    BEFORE UPDATE ON reservation_options
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_options_updated_at();

-- 10. 기존 selected_options 데이터를 reservation_options로 마이그레이션
-- JSONB 데이터를 파싱하여 개별 옵션으로 변환
INSERT INTO reservation_options (reservation_id, option_id, ea, price, total_price, status, note)
SELECT 
    r.id as reservation_id,
    key as option_id,
    COALESCE((value->>'ea')::integer, 1) as ea,
    COALESCE((value->>'price')::decimal(10,2), 0) as price,
    COALESCE((value->>'ea')::integer, 1) * COALESCE((value->>'price')::decimal(10,2), 0) as total_price,
    COALESCE(value->>'status', 'active') as status,
    value->>'note' as note
FROM reservations r
CROSS JOIN LATERAL jsonb_each(r.selected_options) AS kv(key, value)
WHERE r.selected_options IS NOT NULL 
  AND r.selected_options != '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM reservation_options ro 
    WHERE ro.reservation_id = r.id
  );

-- 11. 기존 selected_option_prices 데이터도 마이그레이션 (가격이 다른 경우)
INSERT INTO reservation_options (reservation_id, option_id, ea, price, total_price, status, note)
SELECT 
    r.id as reservation_id,
    key as option_id,
    COALESCE((value->>'ea')::integer, 1) as ea,
    COALESCE((value->>'price')::decimal(10,2), 0) as price,
    COALESCE((value->>'ea')::integer, 1) * COALESCE((value->>'price')::decimal(10,2), 0) as total_price,
    COALESCE(value->>'status', 'active') as status,
    value->>'note' as note
FROM reservations r
CROSS JOIN LATERAL jsonb_each(r.selected_option_prices) AS kv(key, value)
WHERE r.selected_option_prices IS NOT NULL 
  AND r.selected_option_prices != '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM reservation_options ro 
    WHERE ro.reservation_id = r.id 
    AND ro.option_id = key
  );

-- 12. 테이블 코멘트 추가
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
