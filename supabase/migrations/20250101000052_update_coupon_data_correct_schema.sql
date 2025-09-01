-- 쿠폰 데이터 업데이트 (올바른 스키마 사용)
-- Migration: 20250101000052_update_coupon_data_correct_schema

-- GYG9 쿠폰에 할인 정보 추가 (percentage_value 사용)
UPDATE coupons 
SET 
  discount_type = 'percentage',
  percentage_value = 9.00,
  fixed_value = NULL
WHERE coupon_code = 'GYG9';

-- 다른 쿠폰들도 할인 정보 추가
UPDATE coupons 
SET 
  discount_type = 'fixed',
  percentage_value = NULL,
  fixed_value = 20.00
WHERE coupon_code = 'SAVE20';

UPDATE coupons 
SET 
  discount_type = 'percentage',
  percentage_value = 15.00,
  fixed_value = NULL
WHERE coupon_code = 'CHANNEL15';

UPDATE coupons 
SET 
  discount_type = 'fixed',
  percentage_value = NULL,
  fixed_value = 5.00
WHERE coupon_code = 'PRODUCT5';

UPDATE coupons 
SET 
  discount_type = 'percentage',
  percentage_value = 10.00,
  fixed_value = NULL
WHERE coupon_code = 'WELCOME10';

-- 결과 확인
SELECT coupon_code, discount_type, percentage_value, fixed_value, status 
FROM coupons 
WHERE status = 'active';
