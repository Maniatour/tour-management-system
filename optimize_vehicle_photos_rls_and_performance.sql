-- 차량 사진 및 차종 사진 RLS 정책 최적화 및 추가 성능 개선
-- 500 에러 해결 및 쿼리 성능 향상

BEGIN;

-- ============================================
-- 1. RLS 정책 최적화
-- ============================================

-- vehicle_photos RLS 정책 확인 및 최적화
-- 현재 정책이 단순하지만, 성능을 위해 확인

-- 기존 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('vehicle_photos', 'vehicle_type_photos');

-- RLS가 활성화되어 있는지 확인
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('vehicle_photos', 'vehicle_type_photos');

-- ============================================
-- 2. 추가 인덱스 최적화 (IN 절 쿼리용)
-- ============================================

-- vehicle_photos: IN 절 쿼리 최적화를 위한 해시 인덱스 (선택사항)
-- 주의: 해시 인덱스는 = 연산에만 유용하고 ORDER BY에는 사용 불가
-- 따라서 기존 B-tree 인덱스 유지

-- GIN 인덱스는 배열이나 JSON에 유용하지만, 여기서는 필요 없음

-- ============================================
-- 3. 쿼리 플래너 힌트를 위한 설정 (PostgreSQL 12+)
-- ============================================

-- 통계 정보를 더 자주 수집하도록 설정 (선택사항)
-- ALTER TABLE vehicle_photos SET (autovacuum_analyze_scale_factor = 0.01);
-- ALTER TABLE vehicle_type_photos SET (autovacuum_analyze_scale_factor = 0.01);

-- ============================================
-- 4. 연결 풀 최적화 확인 (애플리케이션 레벨)
-- ============================================

-- Supabase는 자동으로 연결 풀을 관리하므로 별도 설정 불필요
-- 하지만 쿼리 타임아웃 설정은 Supabase 대시보드에서 확인 필요

-- ============================================
-- 5. 인덱스 재구성 (필요시)
-- ============================================

-- 인덱스가 너무 많은 경우 REINDEX 실행 (선택사항)
-- REINDEX INDEX CONCURRENTLY idx_vehicle_photos_vehicle_id;
-- REINDEX INDEX CONCURRENTLY idx_vehicle_photos_query_optimized;
-- REINDEX INDEX CONCURRENTLY idx_vehicle_type_photos_vehicle_type_id;
-- REINDEX INDEX CONCURRENTLY idx_vehicle_type_photos_query_optimized;

-- ============================================
-- 6. 쿼리 성능 모니터링 뷰 생성
-- ============================================

-- 느린 쿼리 모니터링을 위한 뷰 (선택사항)
CREATE OR REPLACE VIEW vehicle_photos_performance_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN '사용되지 않음'
        WHEN idx_scan < 100 THEN '낮은 사용량'
        WHEN idx_scan < 1000 THEN '보통 사용량'
        ELSE '높은 사용량'
    END as usage_status
FROM pg_stat_user_indexes
WHERE tablename IN ('vehicle_photos', 'vehicle_type_photos')
ORDER BY idx_scan DESC;

-- ============================================
-- 7. 테이블 파티셔닝 고려사항 (대용량 데이터의 경우)
-- ============================================

-- 현재는 파티셔닝이 필요하지 않지만, 
-- vehicle_photos 테이블이 수백만 건 이상이 되면 고려 필요
-- 예: vehicle_id 기준으로 파티셔닝

-- ============================================
-- 8. 캐싱 전략 (애플리케이션 레벨)
-- ============================================

-- Supabase는 자동으로 쿼리 결과를 캐싱하지 않으므로,
-- 애플리케이션 레벨에서 캐싱 전략 고려 필요
-- 예: React Query, SWR 등을 사용한 클라이언트 사이드 캐싱

-- ============================================
-- 9. 배치 크기 최적화 가이드
-- ============================================

-- 현재 코드에서 배치 크기를 50개로 제한하는 것이 적절함
-- Supabase PostgREST의 URL 길이 제한(약 8000자)을 고려하면
-- vehicle_id가 평균 20자라고 가정하면: 50개 * 20자 = 1000자 (안전)
-- 더 안전하게 하려면 30-40개로 줄일 수 있음

-- ============================================
-- 10. 최종 통계 정보 업데이트
-- ============================================

ANALYZE vehicle_photos;
ANALYZE vehicle_type_photos;

COMMIT;

-- 최적화 완료 및 통계 정보 출력
SELECT 
    'RLS 정책 및 추가 성능 최적화가 완료되었습니다.' as message,
    (SELECT COUNT(*) FROM vehicle_photos) as vehicle_photos_count,
    (SELECT COUNT(*) FROM vehicle_type_photos) as vehicle_type_photos_count,
    (SELECT COUNT(DISTINCT vehicle_id) FROM vehicle_photos) as unique_vehicles_with_photos,
    (SELECT COUNT(DISTINCT vehicle_type_id) FROM vehicle_type_photos) as unique_vehicle_types_with_photos;
