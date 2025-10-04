-- product_schedules 테이블 RLS 정책 설정

-- 1. RLS 활성화
ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "product_schedules_select_policy" ON product_schedules;
DROP POLICY IF EXISTS "product_schedules_insert_policy" ON product_schedules;
DROP POLICY IF EXISTS "product_schedules_update_policy" ON product_schedules;
DROP POLICY IF EXISTS "product_schedules_delete_policy" ON product_schedules;

-- 3. 팀 기반 정책 생성
-- 읽기 정책 (select)
CREATE POLICY "product_schedules_select_policy" ON product_schedules
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND users.team_id = (
                SELECT team_id FROM products 
                WHERE products.id = product_schedules.product_id
            )
        )
    );

-- 삽입 정책 (insert)
CREATE POLICY "product_schedules_insert_policy" ON product_schedules
    FOR INSERT 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND EXISTS (
                SELECT 1 FROM products 
                WHERE products.id = product_schedules.product_id 
                AND products.team_id = users.team_id
            )
        )
    );

-- 업데이트 정책 (update)
CREATE POLICY "product_schedules_update_policy" ON product_schedules
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND EXISTS (
                SELECT 1 FROM products 
                WHERE products.id = product_schedules.product_id 
                AND products.team_id = users.team_id
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND EXISTS (
                SELECT 1 FROM products 
                WHERE products.id = product_schedules.product_id 
                AND products.team_id = users.team_id
            )
        )
    );

-- 삭제 정책 (delete)
CREATE POLICY "product_schedules_delete_policy" ON product_schedules
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND EXISTS (
                SELECT 1 FROM products 
                WHERE products.id = product_schedules.product_id 
                AND products.team_id = users.team_id
            )
        )
    );

-- 4. 테스트를 위한 관리자 계정 예외 (선택사항)
-- 관리자는 모든 데이터에 접근 가능
CREATE POLICY "product_schedules_admin_policy" ON product_schedules
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.email() 
            AND users.role = 'admin'
        )
    );

-- 5. 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'product_schedules';

-- 6. 성공 메시지
SELECT 'product_schedules RLS 정책 설정 완료' as status;
