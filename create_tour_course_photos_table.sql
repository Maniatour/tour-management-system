-- 투어 코스 사진 테이블 생성
CREATE TABLE IF NOT EXISTS tour_course_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES tour_courses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  thumbnail_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);

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

-- Storage 정책 설정
CREATE POLICY "tour_course_photos_storage_select_policy" ON storage.objects
  FOR SELECT USING (bucket_id = 'tour-course-photos');

CREATE POLICY "tour_course_photos_storage_insert_policy" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');

CREATE POLICY "tour_course_photos_storage_update_policy" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');

CREATE POLICY "tour_course_photos_storage_delete_policy" ON storage.objects
  FOR DELETE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');
