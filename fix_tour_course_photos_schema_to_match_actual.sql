-- 실제 데이터베이스 스키마에 맞춰 tour_course_photos 테이블 수정
-- 기존 테이블이 있다면 삭제하고 실제 스키마에 맞게 다시 생성

DROP TABLE IF EXISTS tour_course_photos CASCADE;

-- 실제 스키마에 맞는 tour_course_photos 테이블 생성
CREATE TABLE tour_course_photos (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES tour_courses(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_alt_ko VARCHAR(255),
    photo_alt_en VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sort_order INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    uploaded_by TEXT
);

-- 인덱스 생성
CREATE INDEX idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
CREATE INDEX idx_tour_course_photos_display_order ON tour_course_photos(display_order);

-- RLS 정책 설정
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "tour_course_photos_select_policy" ON tour_course_photos
    FOR SELECT USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "tour_course_photos_insert_policy" ON tour_course_photos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "tour_course_photos_update_policy" ON tour_course_photos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "tour_course_photos_delete_policy" ON tour_course_photos
    FOR DELETE USING (auth.role() = 'authenticated');

-- Storage 버킷 생성 (이미 존재할 수 있음)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-course-photos', 'tour-course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정 (기존 정책이 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS "tour_course_photos_storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "tour_course_photos_storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "tour_course_photos_storage_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "tour_course_photos_storage_delete_policy" ON storage.objects;

CREATE POLICY "tour_course_photos_storage_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'tour-course-photos');

CREATE POLICY "tour_course_photos_storage_insert_policy" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');

CREATE POLICY "tour_course_photos_storage_update_policy" ON storage.objects
    FOR UPDATE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');

CREATE POLICY "tour_course_photos_storage_delete_policy" ON storage.objects
    FOR DELETE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');

-- 완료 메시지
SELECT 'tour_course_photos 테이블이 실제 스키마에 맞게 생성되었습니다.' as message;
