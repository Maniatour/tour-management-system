-- 가장 간단한 bucket 충돒 해결

-- 1단계: 기존 bucket 완전 삭제
DELETE FROM storage.objects WHERE bucket_id = 'tour-photos';
DELETE FROM storage.buckets WHERE id = 'tour-photos';

-- 2단계: 새 bucket 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  100 * 1024 * 1024, -- 100MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
);

-- 3단계: 최소한의 정책만 생성
CREATE POLICY "Open storage" ON storage.buckets FOR ALL USING (true);
CREATE POLICY "Open objects" ON storage.objects FOR ALL USING (bucket_id = 'tour-photos');

-- 4단계: 확인
SELECT 
  'Bucket Created!' as status,
  id,
  name,
  public
FROM storage.buckets 
WHERE id = 'tour-photos';
