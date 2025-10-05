-- 상품 테이블에 투어 출발 시간 컬럼 추가
-- 여러 시간을 저장할 수 있도록 JSON 배열 형태로 저장

-- 1. 기존 tour_departure_time 컬럼이 있다면 삭제 (단일 시간용이었을 경우)
ALTER TABLE products DROP COLUMN IF EXISTS tour_departure_time;

-- 2. 새로운 tour_departure_times 컬럼 추가 (JSON 배열 형태)
ALTER TABLE products 
ADD COLUMN tour_departure_times JSONB DEFAULT '[]'::jsonb;

-- 3. 컬럼에 코멘트 추가
COMMENT ON COLUMN products.tour_departure_times IS '투어 출발 시간 목록 (JSON 배열). 예: ["09:00", "14:00", "18:00"]';

-- 4. 기존 데이터 마이그레이션 (기존에 tour_departure_time 값이 있었다면)
-- 예시: 기존 단일 시간이 있었다면 배열로 변환
-- UPDATE products 
-- SET tour_departure_times = CASE 
--   WHEN tour_departure_time IS NOT NULL AND tour_departure_time != '' 
--   THEN jsonb_build_array(tour_departure_time)
--   ELSE '[]'::jsonb 
-- END;

-- 5. 인덱스 추가 (JSON 배열 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_products_tour_departure_times 
ON products USING GIN (tour_departure_times);

-- 6. 제약조건 추가 (유효한 시간 형식 검증)
ALTER TABLE products 
ADD CONSTRAINT check_tour_departure_times_format 
CHECK (
  jsonb_array_length(tour_departure_times) >= 0 
  AND jsonb_array_length(tour_departure_times) <= 10
  AND tour_departure_times::text ~ '^\[("[0-2][0-9]:[0-5][0-9]")(,"[0-2][0-9]:[0-5][0-9]")*\]$'
);

-- 7. 예시 데이터 추가 (테스트용)
-- INSERT INTO products (id, name, tour_departure_times) 
-- VALUES (gen_random_uuid(), '테스트 상품', '["09:00", "14:00", "18:00"]')
-- ON CONFLICT DO NOTHING;

-- 8. 투어 스케줄에서 상품의 출발 시간을 참조할 수 있도록 추가 필드 (선택사항)
-- 기존 tour_schedules 테이블에 상품에서 선택한 출발 시간을 저장하는 필드가 필요할 경우
-- ALTER TABLE tour_schedules 
-- ADD COLUMN IF NOT EXISTS selected_departure_time TIME;

-- 9. 투어 스케줄에서 상품 출발 시간과 연결하는 함수 예시
CREATE OR REPLACE FUNCTION get_available_departure_times(product_id uuid)
RETURNS TEXT[] AS $$
DECLARE
    departure_times TEXT[];
BEGIN
    -- 상품의 출발 시간 배열을 가져와서 문자열 배열로 변환
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(tour_departure_times)
        FROM products 
        WHERE id = product_id
    ) INTO departure_times;
    
    RETURN COALESCE(departure_times, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- 10. 투어 스케줄에서 특정 시간이 해당 상품의 유효한 출발 시간인지 확인하는 함수
CREATE OR REPLACE FUNCTION is_valid_departure_time(product_id uuid, departure_time time)
RETURNS BOOLEAN AS $$
DECLARE
    is_valid BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM products 
        WHERE id = product_id 
        AND tour_departure_times @> ('"' || departure_time || '"')::jsonb
    ) INTO is_valid;
    
    RETURN is_valid;
END;
$$ LANGUAGE plpgsql;

-- 11. 사용 예시 및 문서화
COMMENT ON FUNCTION get_available_departure_times(uuid) IS '상품의 사용 가능한 출발 시간 목록을 반환합니다';
COMMENT ON FUNCTION is_valid_departure_time(uuid, time) IS '특정 시간이 해당 상품의 유효한 출발 시간인지 확인합니다';

-- 12. 트리거 예시: 투어 출발 시간이 변경될 때 로그 기록
CREATE OR REPLACE FUNCTION log_tour_departure_times_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tour_departure_times IS DISTINCT FROM NEW.tour_departure_times THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, created_at)
        VALUES (
            'products',
            NEW.id,
            'UPDATE_DEPARTURE_TIMES',
            jsonb_build_object('tour_departure_times', OLD.tour_departure_times),
            jsonb_build_object('tour_departure_times', NEW.tour_departure_times),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (audit_logs 테이블이 있는 경우에만)
-- DROP TRIGGER IF EXISTS trigger_log_tour_departure_times_change ON products;
-- CREATE TRIGGER trigger_log_tour_departure_times_change
--     AFTER UPDATE ON products
--     FOR EACH ROW
--     EXECUTE FUNCTION log_tour_departure_times_change();

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'tour_departure_times 컬럼 추가 완료!';
    RAISE NOTICE '사용 방법:';
    RAISE NOTICE '1. 상품에 출발 시간 추가: UPDATE products SET tour_departure_times = ''["09:00", "14:00", "18:00"]'' WHERE id = ''상품ID'';';
    RAISE NOTICE '2. 사용 가능한 출발 시간 조회: SELECT * FROM get_available_departure_times(''상품ID'');';
    RAISE NOTICE '3. 출발 시간 검증: SELECT * FROM is_valid_departure_time(''상품ID'', ''09:00''::time);';
END $$;
