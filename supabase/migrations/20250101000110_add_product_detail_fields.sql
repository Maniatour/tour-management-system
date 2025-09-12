-- 상품 세부정보 필드 추가
-- 이 마이그레이션은 products 테이블에 상세 정보 필드들을 추가합니다.

-- products 테이블에 새로운 컬럼들 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS included TEXT,
ADD COLUMN IF NOT EXISTS not_included TEXT,
ADD COLUMN IF NOT EXISTS slogan1 TEXT,
ADD COLUMN IF NOT EXISTS slogan2 TEXT,
ADD COLUMN IF NOT EXISTS slogan3 TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS pickup_drop_info TEXT,
ADD COLUMN IF NOT EXISTS luggage_info TEXT,
ADD COLUMN IF NOT EXISTS tour_operation_info TEXT,
ADD COLUMN IF NOT EXISTS preparation_info TEXT,
ADD COLUMN IF NOT EXISTS small_group_info TEXT,
ADD COLUMN IF NOT EXISTS companion_info TEXT,
ADD COLUMN IF NOT EXISTS exclusive_booking_info TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
ADD COLUMN IF NOT EXISTS chat_announcement TEXT;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN products.included IS '포함 사항';
COMMENT ON COLUMN products.not_included IS '불포함 사항';
COMMENT ON COLUMN products.slogan1 IS '슬로건 1';
COMMENT ON COLUMN products.slogan2 IS '슬로건 2';
COMMENT ON COLUMN products.slogan3 IS '슬로건 3';
COMMENT ON COLUMN products.description IS '상품 설명';
COMMENT ON COLUMN products.pickup_drop_info IS '픽업/드롭 정보';
COMMENT ON COLUMN products.luggage_info IS '수하물 정보';
COMMENT ON COLUMN products.tour_operation_info IS '투어 운영 정보';
COMMENT ON COLUMN products.preparation_info IS '준비 사항';
COMMENT ON COLUMN products.small_group_info IS '소그룹 정보';
COMMENT ON COLUMN products.companion_info IS '동반자 정보';
COMMENT ON COLUMN products.exclusive_booking_info IS '독점 예약 정보';
COMMENT ON COLUMN products.cancellation_policy IS '취소 정책';
COMMENT ON COLUMN products.chat_announcement IS '채팅 공지사항';
