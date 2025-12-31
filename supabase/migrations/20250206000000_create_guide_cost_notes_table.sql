-- 가이드비 관리 노트 테이블 생성
-- 작성일: 2025-02-06

-- 가이드비 관리 페이지 노트 테이블
CREATE TABLE IF NOT EXISTS guide_cost_notes (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- 단일 노트만 유지하기 위한 제약 (id가 고정된 하나의 행만 존재)
-- 또는 upsert를 사용하여 항상 하나의 노트만 유지

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_guide_cost_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_guide_cost_notes_updated_at ON guide_cost_notes;

CREATE TRIGGER trigger_update_guide_cost_notes_updated_at
    BEFORE UPDATE ON guide_cost_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_guide_cost_notes_updated_at();

-- 초기 노트 행 생성 (없는 경우)
INSERT INTO guide_cost_notes (id, note)
SELECT '00000000-0000-0000-0000-000000000001', ''
WHERE NOT EXISTS (
    SELECT 1 FROM guide_cost_notes WHERE id = '00000000-0000-0000-0000-000000000001'
);

-- RLS 정책 설정
ALTER TABLE guide_cost_notes ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "guide_cost_notes_select_policy" ON guide_cost_notes;
DROP POLICY IF EXISTS "guide_cost_notes_insert_policy" ON guide_cost_notes;
DROP POLICY IF EXISTS "guide_cost_notes_update_policy" ON guide_cost_notes;

-- 모든 사용자가 읽기 가능
CREATE POLICY "guide_cost_notes_select_policy" ON guide_cost_notes
    FOR SELECT USING (true);

-- 모든 사용자가 삽입 가능
CREATE POLICY "guide_cost_notes_insert_policy" ON guide_cost_notes
    FOR INSERT WITH CHECK (true);

-- 모든 사용자가 업데이트 가능 (단일 노트만 업데이트)
CREATE POLICY "guide_cost_notes_update_policy" ON guide_cost_notes
    FOR UPDATE USING (true);

-- 주석 추가
COMMENT ON TABLE guide_cost_notes IS '가이드비 관리 페이지 노트 테이블';

