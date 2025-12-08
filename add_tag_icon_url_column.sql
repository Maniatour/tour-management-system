-- 태그 테이블에 아이콘 URL 컬럼 추가

-- 1. tags 테이블에 icon_url 컬럼 추가
ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- 2. 컬럼 코멘트 추가
COMMENT ON COLUMN tags.icon_url IS '태그 아이콘 이미지 URL';

-- 3. 스토리지 버킷 생성 (태그 아이콘용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tag-icons', 'tag-icons', true)
ON CONFLICT (id) DO NOTHING;

-- 4. 스토리지 정책 설정
CREATE POLICY "Anyone can view tag icons" ON storage.objects
FOR SELECT USING (bucket_id = 'tag-icons');

CREATE POLICY "Authenticated users can upload tag icons" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'tag-icons' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update tag icons" ON storage.objects
FOR UPDATE USING (bucket_id = 'tag-icons' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tag icons" ON storage.objects
FOR DELETE USING (bucket_id = 'tag-icons' AND auth.role() = 'authenticated');

