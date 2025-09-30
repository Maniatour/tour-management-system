-- 이메일 중복 문제 확인 및 해결 SQL
-- Jameshan82@gmail.com과 jameshan82@gmail.com 중복 처리

BEGIN;

-- 1. 현재 team 테이블의 상태 확인
SELECT 'Current team table status:' as info;
SELECT email, name_ko, is_active, created_at FROM team WHERE email ILIKE '%jameshan82%' ORDER BY email;

-- 2. 중복된 레코드가 있는지 확인
SELECT 'Duplicate check:' as info;
SELECT 
    email,
    COUNT(*) as count,
    STRING_AGG(name_ko, ', ') as names
FROM team 
WHERE email ILIKE '%jameshan82%'
GROUP BY email
HAVING COUNT(*) > 1;

-- 3. 외래키 참조 상태 확인
SELECT 'Tours table references:' as info;
SELECT id, tour_guide_id, assistant_id FROM tours 
WHERE tour_guide_id ILIKE '%jameshan82%' OR assistant_id ILIKE '%jameshan82%';

SELECT 'Off schedules table references:' as info;
SELECT id, team_email, approved_by FROM off_schedules 
WHERE team_email ILIKE '%jameshan82%' OR approved_by ILIKE '%jameshan82%';

-- 4. 상황에 따른 처리
-- Case 1: jameshan82@gmail.com이 이미 존재하고 Jameshan82@gmail.com이 없는 경우
-- (이미 변경이 완료된 상태)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM team WHERE email = 'jameshan82@gmail.com') 
       AND NOT EXISTS (SELECT 1 FROM team WHERE email = 'Jameshan82@gmail.com') THEN
        RAISE NOTICE 'Email change already completed. jameshan82@gmail.com exists, Jameshan82@gmail.com does not exist.';
    END IF;
END $$;

-- Case 2: 둘 다 존재하는 경우 (중복)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM team WHERE email = 'jameshan82@gmail.com') 
       AND EXISTS (SELECT 1 FROM team WHERE email = 'Jameshan82@gmail.com') THEN
        RAISE NOTICE 'Both emails exist. Need to merge or delete duplicate.';
        
        -- 외래키를 jameshan82@gmail.com으로 통일
        UPDATE tours 
        SET tour_guide_id = 'jameshan82@gmail.com'
        WHERE tour_guide_id = 'Jameshan82@gmail.com';
        
        UPDATE tours 
        SET assistant_id = 'jameshan82@gmail.com'
        WHERE assistant_id = 'Jameshan82@gmail.com';
        
        UPDATE off_schedules 
        SET team_email = 'jameshan82@gmail.com'
        WHERE team_email = 'Jameshan82@gmail.com';
        
        UPDATE off_schedules 
        SET approved_by = 'jameshan82@gmail.com'
        WHERE approved_by = 'Jameshan82@gmail.com';
        
        -- 중복 레코드 삭제
        DELETE FROM team WHERE email = 'Jameshan82@gmail.com';
        
        RAISE NOTICE 'Duplicate resolved. All references updated to jameshan82@gmail.com';
    END IF;
END $$;

-- Case 3: Jameshan82@gmail.com만 존재하는 경우
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM team WHERE email = 'jameshan82@gmail.com') 
       AND EXISTS (SELECT 1 FROM team WHERE email = 'Jameshan82@gmail.com') THEN
        RAISE NOTICE 'Only Jameshan82@gmail.com exists. Proceeding with email change.';
        
        -- 외래키 먼저 업데이트
        UPDATE tours 
        SET tour_guide_id = 'jameshan82@gmail.com'
        WHERE tour_guide_id = 'Jameshan82@gmail.com';
        
        UPDATE tours 
        SET assistant_id = 'jameshan82@gmail.com'
        WHERE assistant_id = 'Jameshan82@gmail.com';
        
        UPDATE off_schedules 
        SET team_email = 'jameshan82@gmail.com'
        WHERE team_email = 'Jameshan82@gmail.com';
        
        UPDATE off_schedules 
        SET approved_by = 'jameshan82@gmail.com'
        WHERE approved_by = 'Jameshan82@gmail.com';
        
        -- team 테이블 이메일 업데이트
        UPDATE team 
        SET email = 'jameshan82@gmail.com'
        WHERE email = 'Jameshan82@gmail.com';
        
        RAISE NOTICE 'Email change completed successfully.';
    END IF;
END $$;

-- 5. 최종 상태 확인
SELECT 'Final team table status:' as info;
SELECT email, name_ko, is_active FROM team WHERE email ILIKE '%jameshan82%' ORDER BY email;

SELECT 'Final tours references:' as info;
SELECT id, tour_guide_id, assistant_id FROM tours 
WHERE tour_guide_id = 'jameshan82@gmail.com' OR assistant_id = 'jameshan82@gmail.com';

SELECT 'Final off_schedules references:' as info;
SELECT id, team_email, approved_by FROM off_schedules 
WHERE team_email = 'jameshan82@gmail.com' OR approved_by = 'jameshan82@gmail.com';

COMMIT;

-- 롤백이 필요한 경우:
-- ROLLBACK;
