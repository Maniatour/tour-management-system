-- 차량 사진 및 차종 사진 쿼리 성능 최적화 스크립트 (수정 버전)
-- 500 에러 해결 및 대량 IN 절 쿼리 성능 향상
-- 인덱스 행 크기 제한 문제 해결

-- 주의: VACUUM은 트랜잭션 블록 밖에서 실행되어야 하므로 BEGIN/COMMIT 제거

-- ============================================
-- 1. 현재 인덱스 상태 확인
-- ============================================

-- vehicle_photos 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vehicle_photos'
ORDER BY indexname;

-- vehicle_type_photos 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'vehicle_type_photos'
ORDER BY indexname;

-- ============================================
-- 2. 최적화된 인덱스 생성 (INCLUDE 절 제거)
-- ============================================

-- vehicle_photos: IN 절 + ORDER BY 최적화
-- 주의: INCLUDE 절은 photo_url이 매우 길어서 인덱스 행 크기 제한(8KB) 초과
-- 따라서 INCLUDE 절 없이 기본 인덱스만 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_query_optimized 
ON vehicle_photos(vehicle_id, display_order, is_primary DESC);

-- vehicle_type_photos: IN 절 + ORDER BY 최적화
-- 주의: INCLUDE 절은 photo_url과 description이 매우 길어서 인덱스 행 크기 제한 초과
-- 따라서 INCLUDE 절 없이 기본 인덱스만 생성
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_query_optimized 
ON vehicle_type_photos(vehicle_type_id, display_order, is_primary DESC);

-- ============================================
-- 3. 부분 인덱스 (Partial Index) 최적화
-- ============================================

-- is_primary = true인 레코드만 인덱싱 (더 작은 인덱스, 더 빠른 조회)
DROP INDEX IF EXISTS idx_vehicle_photos_primary_only;
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_primary_only 
ON vehicle_photos(vehicle_id) 
WHERE is_primary = true;

DROP INDEX IF EXISTS idx_vehicle_type_photos_primary_only;
CREATE INDEX IF NOT EXISTS idx_vehicle_type_photos_primary_only 
ON vehicle_type_photos(vehicle_type_id) 
WHERE is_primary = true;

-- ============================================
-- 4. 통계 정보 상세 설정
-- ============================================

-- 더 정확한 쿼리 플래닝을 위한 통계 정보 증가
ALTER TABLE vehicle_photos 
    ALTER COLUMN vehicle_id SET STATISTICS 1000,
    ALTER COLUMN display_order SET STATISTICS 1000,
    ALTER COLUMN is_primary SET STATISTICS 1000;

ALTER TABLE vehicle_type_photos 
    ALTER COLUMN vehicle_type_id SET STATISTICS 1000,
    ALTER COLUMN display_order SET STATISTICS 1000,
    ALTER COLUMN is_primary SET STATISTICS 1000;

-- ============================================
-- 5. 테이블 통계 정보 업데이트
-- ============================================

-- 통계 정보 수집 (쿼리 플래너가 최적의 실행 계획 선택)
ANALYZE VERBOSE vehicle_photos;
ANALYZE VERBOSE vehicle_type_photos;
ANALYZE VERBOSE vehicles;
ANALYZE VERBOSE vehicle_types;

-- ============================================
-- 6. 인덱스 사용 통계 확인
-- ============================================

-- 인덱스 사용 현황 확인
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE relname IN ('vehicle_photos', 'vehicle_type_photos')
ORDER BY idx_scan DESC;

-- ============================================
-- 7. 테이블 크기 확인
-- ============================================

-- 테이블 및 인덱스 크기 확인
SELECT 
    table_schema as schemaname,
    table_name as tablename,
    pg_size_pretty(pg_total_relation_size(table_schema||'.'||table_name)) AS total_size,
    pg_size_pretty(pg_relation_size(table_schema||'.'||table_name)) AS table_size,
    pg_size_pretty(pg_total_relation_size(table_schema||'.'||table_name) - pg_relation_size(table_schema||'.'||table_name)) AS indexes_size
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('vehicle_photos', 'vehicle_type_photos', 'vehicles', 'vehicle_types')
  AND table_type = 'BASE TABLE'
ORDER BY pg_total_relation_size(table_schema||'.'||table_name) DESC;

-- ============================================
-- 8. 테이블 최적화 (VACUUM) - 트랜잭션 블록 밖에서 실행
-- ============================================

-- 주의: VACUUM은 트랜잭션 블록 밖에서 실행되어야 합니다
-- 아래 명령어들을 별도로 실행하세요:
-- VACUUM ANALYZE vehicle_photos;
-- VACUUM ANALYZE vehicle_type_photos;

-- 최적화 완료 메시지
SELECT 
    '차량 사진 및 차종 사진 쿼리 성능 최적화가 완료되었습니다.' as message,
    NOW() as optimized_at;
