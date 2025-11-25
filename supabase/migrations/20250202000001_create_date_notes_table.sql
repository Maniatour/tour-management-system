-- 날짜별 노트 테이블 생성
CREATE TABLE IF NOT EXISTS date_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_date DATE NOT NULL UNIQUE,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_date_notes_note_date ON date_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_date_notes_created_by ON date_notes(created_by);

-- RLS 정책 (모든 사용자가 읽기 가능, 인증된 사용자만 쓰기 가능)
ALTER TABLE date_notes ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 모든 인증된 사용자가 읽을 수 있음
CREATE POLICY "Allow authenticated users to read date notes"
    ON date_notes
    FOR SELECT
    TO authenticated
    USING (true);

-- 쓰기 정책: 모든 인증된 사용자가 쓸 수 있음
CREATE POLICY "Allow authenticated users to insert date notes"
    ON date_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 수정 정책: 모든 인증된 사용자가 수정할 수 있음
CREATE POLICY "Allow authenticated users to update date notes"
    ON date_notes
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 삭제 정책: 모든 인증된 사용자가 삭제할 수 있음
CREATE POLICY "Allow authenticated users to delete date notes"
    ON date_notes
    FOR DELETE
    TO authenticated
    USING (true);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_date_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_date_notes_updated_at
    BEFORE UPDATE ON date_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_date_notes_updated_at();

