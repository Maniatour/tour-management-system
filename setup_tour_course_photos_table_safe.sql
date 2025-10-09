-- tour_course_photos 테이블 존재 확인 및 생성
DO $$
BEGIN
    -- 테이블이 존재하지 않으면 생성
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tour_course_photos') THEN
        CREATE TABLE tour_course_photos (
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
        CREATE INDEX idx_tour_course_photos_course_id ON tour_course_photos(course_id);
        CREATE INDEX idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
        CREATE INDEX idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
        
        -- RLS 정책 설정
        ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "tour_course_photos_select_policy" ON tour_course_photos
            FOR SELECT USING (true);
            
        CREATE POLICY "tour_course_photos_insert_policy" ON tour_course_photos
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
            
        CREATE POLICY "tour_course_photos_update_policy" ON tour_course_photos
            FOR UPDATE USING (auth.role() = 'authenticated');
            
        CREATE POLICY "tour_course_photos_delete_policy" ON tour_course_photos
            FOR DELETE USING (auth.role() = 'authenticated');
            
        RAISE NOTICE 'tour_course_photos 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'tour_course_photos 테이블이 이미 존재합니다.';
        
        -- 필요한 컬럼들이 없으면 추가
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_course_photos' AND column_name = 'sort_order') THEN
            ALTER TABLE tour_course_photos ADD COLUMN sort_order INTEGER DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
            RAISE NOTICE 'sort_order 컬럼이 추가되었습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_course_photos' AND column_name = 'is_primary') THEN
            ALTER TABLE tour_course_photos ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
            RAISE NOTICE 'is_primary 컬럼이 추가되었습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_course_photos' AND column_name = 'thumbnail_url') THEN
            ALTER TABLE tour_course_photos ADD COLUMN thumbnail_url TEXT;
            RAISE NOTICE 'thumbnail_url 컬럼이 추가되었습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tour_course_photos' AND column_name = 'uploaded_by') THEN
            ALTER TABLE tour_course_photos ADD COLUMN uploaded_by TEXT;
            RAISE NOTICE 'uploaded_by 컬럼이 추가되었습니다.';
        END IF;
    END IF;
END $$;

-- Storage 버킷 생성 (이미 존재할 수 있음)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-course-photos', 'tour-course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정 (이미 존재할 수 있음)
DO $$
BEGIN
    -- Storage 정책들이 존재하지 않으면 생성
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'tour_course_photos_storage_select_policy') THEN
        CREATE POLICY "tour_course_photos_storage_select_policy" ON storage.objects
            FOR SELECT USING (bucket_id = 'tour-course-photos');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'tour_course_photos_storage_insert_policy') THEN
        CREATE POLICY "tour_course_photos_storage_insert_policy" ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'tour_course_photos_storage_update_policy') THEN
        CREATE POLICY "tour_course_photos_storage_update_policy" ON storage.objects
            FOR UPDATE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'tour_course_photos_storage_delete_policy') THEN
        CREATE POLICY "tour_course_photos_storage_delete_policy" ON storage.objects
            FOR DELETE USING (bucket_id = 'tour-course-photos' AND auth.role() = 'authenticated');
    END IF;
END $$;
