-- 상품 세부정보 필드명 변경
-- 동반자 정보 → 안내사항 (companion_info → notice_info)
-- 독점 예약 정보 → 단독투어 정보 (exclusive_booking_info → private_tour_info)

-- 1. product_details_multilingual 테이블 필드명 변경
ALTER TABLE product_details_multilingual 
RENAME COLUMN companion_info TO notice_info;

ALTER TABLE product_details_multilingual 
RENAME COLUMN exclusive_booking_info TO private_tour_info;

-- 2. product_details_common_multilingual 테이블 필드명 변경
ALTER TABLE product_details_common_multilingual 
RENAME COLUMN companion_info TO notice_info;

ALTER TABLE product_details_common_multilingual 
RENAME COLUMN exclusive_booking_info TO private_tour_info;

-- 3. 컬럼 코멘트 업데이트
COMMENT ON COLUMN product_details_multilingual.notice_info IS '안내사항';
COMMENT ON COLUMN product_details_multilingual.private_tour_info IS '단독투어 정보';

COMMENT ON COLUMN product_details_common_multilingual.notice_info IS '안내사항';
COMMENT ON COLUMN product_details_common_multilingual.private_tour_info IS '단독투어 정보';
