-- ========================================
-- 동적 가격 테이블 구조 개선 - 1단계: 백업
-- ========================================

-- 1. 기존 dynamic_pricing 테이블 백업
CREATE TABLE IF NOT EXISTS dynamic_pricing_backup AS 
SELECT * FROM dynamic_pricing;
