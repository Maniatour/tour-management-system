-- 픽업 호텔 이미지 URL 업데이트 스크립트
-- 구글 드라이브에서 Supabase Storage로 마이그레이션 후 사용

-- 예시: 특정 호텔의 미디어 URL 업데이트
-- 실제 Supabase Storage URL로 교체하세요

UPDATE pickup_hotels 
SET media = ARRAY[
  'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-1/image1.jpg',
  'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-1/image2.jpg',
  'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-1/image3.jpg'
]
WHERE id = 'hotel-id-1';

-- 다른 호텔 예시
UPDATE pickup_hotels 
SET media = ARRAY[
  'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-2/image1.jpg',
  'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-2/image2.jpg'
]
WHERE id = 'hotel-id-2';

-- 기존 미디어에 새 이미지 추가 (기존 이미지 유지)
UPDATE pickup_hotels 
SET media = array_cat(
  COALESCE(media, ARRAY[]::text[]),
  ARRAY[
    'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id-3/new-image.jpg'
  ]
)
WHERE id = 'hotel-id-3';

-- 모든 호텔의 미디어 상태 확인
SELECT 
  id,
  hotel,
  pick_up_location,
  array_length(media, 1) as media_count,
  media
FROM pickup_hotels 
ORDER BY hotel;

-- 특정 호텔의 미디어 확인
SELECT 
  hotel,
  pick_up_location,
  media
FROM pickup_hotels 
WHERE id = 'hotel-id-1';
