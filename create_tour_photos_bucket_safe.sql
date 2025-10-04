-- Supabase Storage: tour-photos bucket 생성 및 정책 설정 (안전 버전)

-- 1. 기존 정책들 먼저 삭제 (충돌 방지)
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;

-- 2. 기존 bucket 삭제 (있는 경우)
DELETE FROM storage.buckets WHERE id = 'tour-photos';

-- 3. 새로운 tour-photos bucket 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
    'tour-photos',
    'tour-photos',
    true,
    52428800, -- 50MB 제한
    ARRAY['avatar/*', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp'],
    now(),
    now()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    updated_at = now();

-- 4. 팀 기반 RLS 정책 생성 (더 안전함)

-- SELECT 정책 - 인증된 사용자 (팀 기반)
CREATE POLICY "Team-based select tour photos" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'tour-photos'
    AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM users us
            WHERE us.email = u.email
            AND us.user_role = ANY(ARRAY['guide', 'admin', 'manager', 'driver'])
            AND (
                us.team_id = ANY(
                    SELECT DISTINCT 
                        CASE 
                            WHEN e.object_table = 'product_schedules' THEN (
                                SELECT p.team_id FROM products p 
                                WHERE p.id = e.object_id::uuid
                            )
                            ELSE (
                                SELECT uu.team_id FROM users uu 
                                WHERE uu.email = auth.email()
                            )
                        END
                    FROM storage.objects e
                    WHERE e.id = storage.objects.id
                )
            )
        )
    )
);

-- INSERT 정책 - 인증된 사용자 (팀 기반)
CREATE POLICY "Team-based insert tour photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'tour-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM users us
            WHERE us.email = u.email
            AND us.user_role = ANY(ARRAY['guide', 'admin', 'manager'])
            AND us.team_id IS NOT NULL
        )
    )
);

-- UPDATE 정책 - 인증된 사용자 (팀 기반)
CREATE POLICY "Team-based update tour photos" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'tour-photos'
    AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM users us
            WHERE us.email = u.email
            AND us.user_role = ANY(ARRAY['guide', 'admin', 'manager'])
        )
    )
);

-- DELETE 정책 - 관리자만 삭제 가능
CREATE POLICY "Admin-only delete tour photos" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'tour-photos'
    AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM users us
            WHERE us.email = u.email
            AND us.user_role = 'admin'
        )
    )
);

-- 5. 공개 읽기 정책 (Public access)
CREATE POLICY "Public read tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- 6. 버킷 생성 확인
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 7. 생성된 정책 확인
SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname LIKE '%tour photos%'
) as policies_exist;

-- 성공 메시지
SELECT 'tour-photos bucket 및 정책 생성 완료' as status;
