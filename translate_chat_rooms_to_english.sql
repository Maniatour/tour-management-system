-- 투어 채팅방 한글을 영문으로 변경
-- 한글 템플릿을 영문 템플릿으로 교체

-- 1. 우선 기존 채팅방 데이터를 영문으로 업데이트
UPDATE chat_rooms 
SET 
  room_name = CASE 
    WHEN room_name LIKE '투어 채팅방 - %' THEN 
      'Tour Chat Room - ' || SUBSTRING(room_name FROM LENGTH('투어 채팅방 - ') + 1)
    ELSE room_name
  END,
  description = CASE 
    WHEN description LIKE '투어 날짜: % 투어 관련 소통을 위한 채팅방입니다.' THEN
      -- 투어 날짜 추출
      SUBSTRING(description FROM '투어 날짜: ([^ ]+)') || ' - ' || 
      COALESCE(
        (SELECT name_en FROM products p 
         JOIN tours t ON p.id = t.product_id 
         WHERE t.id = chat_rooms.tour_id), 
        'Tour'
      ) || ' related communication chat room.'
    WHEN description IS NULL THEN NULL
    ELSE description
  END
WHERE room_name LIKE '투어 채팅방 - %' 
   OR description LIKE '투어 날짜: % 투어 관련 소통을 위한 채팅방입니다.'
   OR description LIKE '% 채팅방'
   OR description LIKE '% 투어 관련%';

-- 2. 일반적인 한글 패턴들을 영문으로 변경
UPDATE chat_rooms 
SET 
  room_name = CASE 
    WHEN room_name LIKE '% 채팅방' THEN 
      REPLACE(room_name, ' 채팅방', ' Chat Room')
    WHEN room_name LIKE '% 투어' THEN 
      REPLACE(room_name, ' 투어', ' Tour')
    ELSE room_name
  END,
  description = CASE 
    WHEN description LIKE '% 투어 관련 문의사항을 남겨주세요.' THEN 
      'Please leave your inquiries related to ' || 
      COALESCE(
        (SELECT name_en FROM products p 
         JOIN tours t ON p.id = t.product_id 
         WHERE t.id = chat_rooms.tour_id), 
        'this tour'
      )
    WHEN description LIKE '% 투어 관련%' THEN 
      REPLACE(description, ' 투어 관련', ' tour related')
    ELSE description
  END
WHERE room_name LIKE '% 채팅방' 
   OR room_name LIKE '% 투어'
   OR description LIKE '% 투어 관련%';

-- 3. 특정 상품명들을 영문으로 매핑 (실제 맞춤 변환이 필요한 경우)
UPDATE chat_rooms 
SET 
  room_name = CASE 
    WHEN room_name LIKE '%도깨비%' THEN 
      REPLACE(room_name, '도깨비', 'Goblin')
    WHEN room_name LIKE '%서울%' THEN 
      REPLACE(room_name, '서울', 'Seoul')
    WHEN room_name LIKE '%부산%' THEN 
      REPLACE(room_name, '부산', 'Busan')
    WHEN room_name LIKE '%제주%' THEN 
      REPLACE(room_name, '제주', 'Jeju')
    ELSE room_name
  END,
  description = CASE 
    WHEN description LIKE '%도깨비%' THEN 
      REPLACE(description, '도깨비', 'Goblin')
    WHEN description LIKE '%서울%' THEN 
      REPLACE(description, '서울', 'Seoul')
    WHEN description LIKE '%부산%' THEN 
      REPLACE(description, '부산', 'Busan')
    WHEN description LIKE '%제주%' THEN 
      REPLACE(description, '제주', 'Jeju')
    ELSE description
  END
WHERE room_name LIKE '%도깨비%' 
   OR room_name LIKE '%서울%'
   OR room_name LIKE '%부산%'
   OR room_name LIKE '%제주%'
   OR description LIKE '%도깨비%'
   OR description LIKE '%서울%'
   OR description LIKE '%부산%'
   OR description LIKE '%제주%';

-- 4. 결과 확인
SELECT 
  id,
  tour_id,
  room_name,
  room_code,
  description,
  is_active,
  created_by,
  created_at,
  updated_at
FROM chat_rooms 
WHERE room_name LIKE '% Chat Room%' OR room_name LIKE '% Tour%'
ORDER BY created_at DESC;
