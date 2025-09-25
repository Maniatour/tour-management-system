-- 투어 리포트 테이블 생성
-- Migration: 202501200012_create_tour_reports_table

CREATE TABLE IF NOT EXISTS tour_reports (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    tour_id TEXT REFERENCES tours(id) ON DELETE CASCADE,
    end_mileage INTEGER,
    cash_balance DECIMAL(10,2),
    customer_count INTEGER,
    weather VARCHAR(50), -- sunny, cloudy, rainy, snowy, windy, foggy
    main_stops_visited TEXT[], -- 방문한 주요 정류장들
    activities_completed TEXT[], -- 완료된 활동들
    overall_mood VARCHAR(50), -- excellent, good, average, poor, terrible
    guest_comments TEXT, -- 고객 코멘트 (직접 입력)
    incidents_delays_health TEXT[], -- 사고/지연/건강 문제
    lost_items_damage TEXT[], -- 분실물/손상
    suggestions_followup TEXT, -- 제안사항 또는 후속 조치 (직접 입력)
    communication VARCHAR(50), -- excellent, good, average, poor
    teamwork VARCHAR(50), -- excellent, good, average, poor
    comments TEXT, -- 기타 코멘트 (직접 입력)
    submitted_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email VARCHAR(255) NOT NULL,
    sign TEXT, -- 서명 (이미지 또는 텍스트)
    office_note TEXT, -- 사무실 메모
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_reports_tour_id ON tour_reports(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_reports_user_email ON tour_reports(user_email);
CREATE INDEX IF NOT EXISTS idx_tour_reports_submitted_on ON tour_reports(submitted_on);

-- RLS 정책 설정
ALTER TABLE tour_reports ENABLE ROW LEVEL SECURITY;

-- 투어 가이드와 드라이버는 자신이 작성한 리포트만 조회/수정 가능
CREATE POLICY "Users can view own tour reports" ON tour_reports
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own tour reports" ON tour_reports
    FOR INSERT WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own tour reports" ON tour_reports
    FOR UPDATE USING (user_email = auth.jwt() ->> 'email');

-- 관리자는 모든 리포트 조회 가능
CREATE POLICY "Admins can view all tour reports" ON tour_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team 
            WHERE email = auth.jwt() ->> 'email' 
            AND position = 'admin'
        )
    );

-- 관리자는 모든 리포트 수정 가능
CREATE POLICY "Admins can update all tour reports" ON tour_reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM team 
            WHERE email = auth.jwt() ->> 'email' 
            AND position = 'admin'
        )
    );

-- 관리자는 모든 리포트 삭제 가능
CREATE POLICY "Admins can delete all tour reports" ON tour_reports
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM team 
            WHERE email = auth.jwt() ->> 'email' 
            AND position = 'admin'
        )
    );
