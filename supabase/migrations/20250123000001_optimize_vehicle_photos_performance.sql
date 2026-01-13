-- 차량 사진 및 차종 사진 테이블 성능 최적화
-- 500 에러 해결 및 쿼리 성능 향상을 위한 최적화

BEGIN;

-- ============================================
-- 1. vehicle_photos 테이블 최적화
-- ============================================

-- 기존 인덱스 확인 및 최적화된 복합 인덱스 생성
-- order by vehicle_id, display_order 쿼리를 위한 최적화된 인덱스
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id_display_order_optimized 
ON vehicle_photos(vehicle_id, display_order ASC NULLS LAST, is_primary DESC NULLS LAST);

-- IN 절 쿼리 최적화를 위한 인덱스 (이미 있지만 확인)
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id_btree 
ON vehicle_photos USING btree(vehicle_id);

-- is_primary 조회 최적화 (이미 있지만 확인)
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_is_primary_optimized 
ON vehicle_photos(vehicle_id, is_primary) 
WHERE is_primary = true;

-- 통계 정보 업데이트 (쿼리 플래너가 최적의 실행 계획을 선택하도록)
ANALYZE vehicle_photos;

-- ============================================
-- 2. vehicle_type_photos 테이블 최적화
-- ============================================

-- 기존 인덱스 확인 및 최적화된 복합 인덱스 생성
-- order by vehicle_type_id, display_order 쿼리를 위한 최적화된 인덱스
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_type_id_display_order_optimized 
ON vehicle_type_photos(vehicle_type_id, display_order ASC NULLS LAST, is_primary DESC NULLS LAST);

-- IN 절 쿼리 최적화를 위한 인덱스 (이미 있지만 확인)
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_vehicle_type_id_btree 
ON vehicle_type_photos USING btree(vehicle_type_id);

-- is_primary 조회 최적화
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_is_primary_optimized 
ON vehicle_type_photos(vehicle_type_id, is_primary) 
WHERE is_primary = true;

-- 통계 정보 업데이트
ANALYZE vehicle_type_photos;

-- ============================================
-- 3. 테이블 통계 정보 업데이트
-- ============================================

-- 모든 관련 테이블의 통계 정보 업데이트
ANALYZE vehicles;
ANALYZE vehicle_types;

-- ============================================
-- 4. 인덱스 사용 통계 확인 (선택사항)
-- ============================================

-- 인덱스 사용 현황 확인 쿼리 (주석 처리)
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('vehicle_photos', 'vehicle_type_photos')
ORDER BY idx_scan DESC;
*/

-- ============================================
-- 5. 불필요한 인덱스 정리 (중복 제거)
-- ============================================

-- 중복되거나 사용되지 않는 인덱스는 수동으로 확인 후 제거
-- DROP INDEX IF EXISTS idx_vehicle_photos_display_order; -- 복합 인덱스로 대체 가능

-- ============================================
-- 6. 쿼리 성능 향상을 위한 추가 최적화
-- ============================================

-- vehicle_photos 테이블에 대한 통계 정보 상세 업데이트
-- 더 정확한 쿼리 플래닝을 위해
ALTER TABLE vehicle_photos ALTER COLUMN vehicle_id SET STATISTICS 1000;
ALTER TABLE vehicle_photos ALTER COLUMN display_order SET STATISTICS 1000;
ALTER TABLE vehicle_photos ALTER COLUMN is_primary SET STATISTICS 1000;

-- vehicle_type_photos 테이블에 대한 통계 정보 상세 업데이트
ALTER TABLE vehicle_type_photos ALTER COLUMN vehicle_type_id SET STATISTICS 1000;
ALTER TABLE vehicle_type_photos ALTER COLUMN display_order SET STATISTICS 1000;
ALTER TABLE vehicle_type_photos ALTER COLUMN is_primary SET STATISTICS 1000;

-- 통계 정보 재수집
ANALYZE vehicle_photos;
ANALYZE vehicle_type_photos;

-- ============================================
-- 7. RLS 정책 최적화 확인
-- ============================================

-- RLS 정책이 쿼리 성능에 영향을 주지 않는지 확인
-- 현재 정책이 단순하므로 문제없지만, 필요시 최적화

-- ============================================
-- 8. 테이블 블로팅 확인 및 VACUUM (선택사항)
-- ============================================

-- 테이블이 크거나 자주 업데이트되는 경우 VACUUM 실행 권장
-- VACUUM ANALYZE vehicle_photos;
-- VACUUM ANALYZE vehicle_type_photos;

COMMIT;

-- 최적화 완료 메시지
SELECT 
    '차량 사진 및 차종 사진 테이블 최적화가 완료되었습니다.' as message,
    (SELECT COUNT(*) FROM vehicle_photos) as vehicle_photos_count,
    (SELECT COUNT(*) FROM vehicle_type_photos) as vehicle_type_photos_count;
