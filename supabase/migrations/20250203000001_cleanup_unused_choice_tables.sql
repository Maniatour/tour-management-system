-- 불필요한 초이스 관련 테이블 및 뷰 정리
-- 여러 번 변경되면서 생성된 불필요한 구조 제거

-- 1. 사용하지 않는 뷰 제거 (product_choices_view는 더 이상 사용하지 않음)
DROP VIEW IF EXISTS product_choices_view CASCADE;

-- 2. 사용하지 않는 함수 제거 (더 이상 필요 없는 마이그레이션 함수들)
DROP FUNCTION IF EXISTS migrate_reservations_to_choices() CASCADE;

-- 3. products.choices JSONB 컬럼 확인 및 정리
-- 주의: 이 컬럼은 아직 사용 중일 수 있으므로 확인 후 제거
-- 먼저 사용 여부 확인 쿼리:
-- SELECT COUNT(*) FROM products WHERE choices IS NOT NULL;

-- 4. reservations.selected_options JSONB 컬럼 확인
-- 주의: 이 컬럼도 확인 후 제거 (reservation_choices 테이블로 마이그레이션 완료 시)
-- 먼저 사용 여부 확인 쿼리:
-- SELECT COUNT(*) FROM reservations WHERE selected_options IS NOT NULL;

-- 5. reservations.selected_choices JSONB 컬럼 확인
-- 주의: 이 컬럼도 확인 후 제거
-- 먼저 사용 여부 확인 쿼리:
-- SELECT COUNT(*) FROM reservations WHERE selected_choices IS NOT NULL;

-- 6. 불필요한 인덱스 제거 (사용하지 않는 컬럼의 인덱스)
-- products.choices 인덱스 (컬럼 제거 시 함께 제거)
-- DROP INDEX IF EXISTS idx_products_choices;

-- reservations.selected_choices 인덱스 (컬럼 제거 시 함께 제거)
-- DROP INDEX IF EXISTS idx_reservations_selected_choices;

-- reservations.selected_options 인덱스 (컬럼 제거 시 함께 제거)
-- DROP INDEX IF EXISTS idx_reservations_selected_options;

-- 7. 정리 완료 후 통계 확인
-- 다음 쿼리로 정리 상태 확인:
-- SELECT 
--   'product_choices' as table_name,
--   COUNT(*) as row_count
-- FROM product_choices
-- UNION ALL
-- SELECT 
--   'choice_options',
--   COUNT(*)
-- FROM choice_options
-- UNION ALL
-- SELECT 
--   'reservation_choices',
--   COUNT(*)
-- FROM reservation_choices;

