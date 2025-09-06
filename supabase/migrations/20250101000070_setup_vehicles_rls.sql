-- vehicles 테이블에 RLS 활성화
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- vehicles 테이블에 대한 RLS 정책 생성
-- 모든 사용자가 읽기 가능
CREATE POLICY "vehicles_select_policy" ON vehicles
    FOR SELECT
    USING (true);

-- 인증된 사용자가 삽입 가능
CREATE POLICY "vehicles_insert_policy" ON vehicles
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 업데이트 가능
CREATE POLICY "vehicles_update_policy" ON vehicles
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "vehicles_delete_policy" ON vehicles
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- vehicles 테이블에 대한 권한 부여
GRANT ALL ON vehicles TO authenticated;
GRANT ALL ON vehicles TO service_role;
