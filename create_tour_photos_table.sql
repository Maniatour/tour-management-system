-- tour_photos 테이블 생성 SQL
-- 투어 사진 업로드 기능을 위한 테이블

BEGIN;

-- 1. tour_photos 테이블 생성
CREATE TABLE IF NOT EXISTS public.tour_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    uploaded_by TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    share_token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_tour_photos_tour_id ON public.tour_photos(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_photos_reservation_id ON public.tour_photos(reservation_id);
CREATE INDEX IF NOT EXISTS idx_tour_photos_uploaded_by ON public.tour_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_tour_photos_created_at ON public.tour_photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_photos_share_token ON public.tour_photos(share_token);

-- 3. RLS (Row Level Security) 정책 설정
ALTER TABLE public.tour_photos ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
-- 모든 사용자가 투어 사진을 조회할 수 있음 (공개 사진)
CREATE POLICY "Anyone can view public tour photos" ON public.tour_photos
    FOR SELECT USING (is_public = true);

-- 인증된 사용자가 투어 사진을 업로드할 수 있음
CREATE POLICY "Authenticated users can upload tour photos" ON public.tour_photos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 업로드한 사용자만 자신의 사진을 수정/삭제할 수 있음
CREATE POLICY "Users can update their own tour photos" ON public.tour_photos
    FOR UPDATE USING (auth.email() = uploaded_by);

CREATE POLICY "Users can delete their own tour photos" ON public.tour_photos
    FOR DELETE USING (auth.email() = uploaded_by);

-- 관리자는 모든 투어 사진을 관리할 수 있음
CREATE POLICY "Admins can manage all tour photos" ON public.tour_photos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team 
            WHERE team.email = auth.email() 
            AND team.is_active = true 
            AND team.position IN ('super', 'office manager', 'op')
        )
    );

-- 5. updated_at 자동 업데이트를 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. updated_at 트리거 생성
CREATE TRIGGER update_tour_photos_updated_at 
    BEFORE UPDATE ON public.tour_photos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 테이블 생성 확인
SELECT 'tour_photos table created successfully' as status;

-- 8. 테이블 구조 확인
\d public.tour_photos;

COMMIT;

-- 롤백이 필요한 경우:
-- ROLLBACK;
