-- 상담 카테고리를 영어로 업데이트하는 스크립트
-- 한국어 카테고리명을 영어로 변경

-- 1. 기존 카테고리 데이터 업데이트
UPDATE consultation_categories 
SET name_en = CASE 
  WHEN name_ko = '일반 문의' THEN 'General Inquiries'
  WHEN name_ko = '예약 관련' THEN 'Booking Related'
  WHEN name_ko = '가격 문의' THEN 'Pricing Inquiries'
  WHEN name_ko = '투어 정보' THEN 'Tour Information'
  WHEN name_ko = '정책 및 규정' THEN 'Policies & Rules'
  ELSE name_en
END,
description_en = CASE 
  WHEN name_ko = '일반 문의' THEN 'General customer inquiries'
  WHEN name_ko = '예약 관련' THEN 'Booking and cancellation inquiries'
  WHEN name_ko = '가격 문의' THEN 'Pricing and payment inquiries'
  WHEN name_ko = '투어 정보' THEN 'Detailed tour information inquiries'
  WHEN name_ko = '정책 및 규정' THEN 'Cancellation, refund policies, etc.'
  ELSE description_en
END
WHERE name_ko IN ('일반 문의', '예약 관련', '가격 문의', '투어 정보', '정책 및 규정');

-- 2. 업데이트 결과 확인
SELECT 
  name_ko as "Korean Name",
  name_en as "English Name", 
  description_ko as "Korean Description",
  description_en as "English Description",
  icon,
  color,
  sort_order
FROM consultation_categories 
ORDER BY sort_order;

-- 3. 템플릿에서도 카테고리 참조 업데이트 (필요시)
-- 템플릿의 카테고리 참조는 ID로 되어 있어서 자동으로 업데이트됨

-- 4. 워크플로우에서도 카테고리 참조 업데이트 (필요시)
-- 워크플로우의 카테고리 참조도 ID로 되어 있어서 자동으로 업데이트됨
