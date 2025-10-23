-- Create reservation expenses table for non-tour expense tracking
-- Migration: 202501200000_create_reservation_expenses_table

begin;

-- 예약 지출 테이블 (투어 이외의 예약에 대한 지출)
CREATE TABLE IF NOT EXISTS reservation_expenses (
    id TEXT PRIMARY KEY, -- 구글 시트 ID (텍스트 타입)
    submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 제출일시
    submitted_by VARCHAR(255) NOT NULL, -- 제출자 (user email)
    paid_to VARCHAR(255) NOT NULL, -- 결제처 (어디에)
    paid_for TEXT NOT NULL, -- 결제내용 (무엇을)
    amount DECIMAL(10,2) NOT NULL, -- 금액
    payment_method VARCHAR(100), -- 결제 방법
    note TEXT, -- 메모
    image_url TEXT, -- 영수증 이미지 URL
    file_path TEXT, -- 파일 경로
    status VARCHAR(50) DEFAULT 'pending', -- 상태 (pending, approved, rejected)
    reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL, -- 예약 ID
    event_id TEXT, -- 이벤트 ID
    audited_by VARCHAR(255), -- 감사자 (OP)
    checked_by VARCHAR(255), -- 확인자
    checked_on TIMESTAMP WITH TIME ZONE, -- 확인일시
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_reservation_expenses_reservation_id ON reservation_expenses(reservation_id);
CREATE INDEX idx_reservation_expenses_submitted_by ON reservation_expenses(submitted_by);
CREATE INDEX idx_reservation_expenses_status ON reservation_expenses(status);
CREATE INDEX idx_reservation_expenses_created_at ON reservation_expenses(created_at);
CREATE INDEX idx_reservation_expenses_event_id ON reservation_expenses(event_id);

-- RLS 정책 설정
ALTER TABLE reservation_expenses ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "reservation_expenses_select_all" ON reservation_expenses
    FOR SELECT
    USING (true);

-- 스태프만 삽입 가능
CREATE POLICY "reservation_expenses_insert_staff" ON reservation_expenses
    FOR INSERT
    WITH CHECK (true);

-- 스태프만 수정 가능
CREATE POLICY "reservation_expenses_update_staff" ON reservation_expenses
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 스태프만 삭제 가능
CREATE POLICY "reservation_expenses_delete_staff" ON reservation_expenses
    FOR DELETE
    USING (true);

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_reservation_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reservation_expenses_updated_at
    BEFORE UPDATE ON reservation_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_expenses_updated_at();

commit;
