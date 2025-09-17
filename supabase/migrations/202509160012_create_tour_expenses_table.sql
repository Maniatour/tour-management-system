-- Create tour expenses table for expense tracking
-- Migration: 202509160012_create_tour_expenses_table

begin;

-- 투어 지출 테이블
CREATE TABLE IF NOT EXISTS tour_expenses (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    tour_id TEXT REFERENCES tours(id) ON DELETE CASCADE, -- 투어 ID
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 제출일시
    paid_to VARCHAR(255) NOT NULL, -- 결제처 (어디에)
    paid_for TEXT NOT NULL, -- 결제내용 (무엇을)
    amount DECIMAL(10,2) NOT NULL, -- 금액
    payment_method VARCHAR(100), -- 결제 방법
    note TEXT, -- 메모
    tour_date DATE NOT NULL, -- 투어 날짜
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL, -- 상품 ID
    submitted_by VARCHAR(255) NOT NULL, -- 제출자 (가이드)
    image_url TEXT, -- 영수증 이미지 URL
    file_path TEXT, -- 파일 경로
    audited_by VARCHAR(255), -- 감사자 (OP)
    checked_by VARCHAR(255), -- 확인자
    checked_on TIMESTAMP WITH TIME ZONE, -- 확인일시
    status VARCHAR(50) DEFAULT 'pending', -- 상태 (pending, approved, rejected)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_tour_expenses_tour_id ON tour_expenses(tour_id);
CREATE INDEX idx_tour_expenses_tour_date ON tour_expenses(tour_date);
CREATE INDEX idx_tour_expenses_submitted_by ON tour_expenses(submitted_by);
CREATE INDEX idx_tour_expenses_status ON tour_expenses(status);
CREATE INDEX idx_tour_expenses_created_at ON tour_expenses(created_at);

-- RLS 정책 설정
ALTER TABLE tour_expenses ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "tour_expenses_select_all" ON tour_expenses
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "tour_expenses_insert_staff" ON tour_expenses
    FOR INSERT
    WITH CHECK (
        public.is_staff(public.current_email())
    );

-- 스태프만 업데이트 가능
CREATE POLICY "tour_expenses_update_staff" ON tour_expenses
    FOR UPDATE
    USING (
        public.is_staff(public.current_email())
    )
    WITH CHECK (
        public.is_staff(public.current_email())
    );

-- 스태프만 삭제 가능
CREATE POLICY "tour_expenses_delete_staff" ON tour_expenses
    FOR DELETE
    USING (
        public.is_staff(public.current_email())
    );

commit;
