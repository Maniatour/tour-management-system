-- tour_course_photos 테이블 스키마 확인 및 수정
-- 실제 데이터베이스 스키마에 맞춰 테이블 구조 확인

-- 1. 현재 테이블 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tour_course_photos'
ORDER BY ordinal_position;

-- 2. 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS tour_course_photos (
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

-- 3. 필요한 컬럼이 없으면 추가
DO $$
BEGIN
    -- photo_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_url TEXT;
    END IF;
    
    -- photo_alt_ko 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_alt_ko'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_alt_ko VARCHAR(255);
    END IF;
    
    -- photo_alt_en 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_alt_en'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_alt_en VARCHAR(255);
    END IF;
    
    -- display_order 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'display_order'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
    
    -- is_primary 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
    
    -- sort_order 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    
    -- thumbnail_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'thumbnail_url'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN thumbnail_url TEXT;
    END IF;
    
    -- uploaded_by 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN uploaded_by TEXT;
    END IF;
END $$;

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_display_order ON tour_course_photos(display_order);

-- 5. RLS 활성화 및 정책 설정
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow public read access to tour_course_photos" ON tour_course_photos;
DROP POLICY IF EXISTS "Allow authenticated users to manage tour_course_photos" ON tour_course_photos;

-- 새로운 정책 생성
CREATE POLICY "Allow public read access to tour_course_photos" ON tour_course_photos
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage tour_course_photos" ON tour_course_photos
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. 최종 테이블 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tour_course_photos'
ORDER BY ordinal_position;
