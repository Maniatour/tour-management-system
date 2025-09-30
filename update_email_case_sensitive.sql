-- 이메일 대소문자 변경 SQL
-- Jameshan82@gmail.com을 jameshan82@gmail.com으로 변경
-- 외래키 관계를 고려한 안전한 업데이트

BEGIN;

-- 1. 먼저 현재 데이터 확인
SELECT 'Before update - team table:' as info;
SELECT email, name_ko FROM team WHERE email ILIKE '%jameshan82%';

SELECT 'Before update - tours table:' as info;
SELECT id, tour_guide_id, assistant_id FROM tours 
WHERE tour_guide_id ILIKE '%jameshan82%' OR assistant_id ILIKE '%jameshan82%';

SELECT 'Before update - off_schedules table:' as info;
SELECT id, team_email, approved_by FROM off_schedules 
WHERE team_email ILIKE '%jameshan82%' OR approved_by ILIKE '%jameshan82%';

-- 2. 외래키 제약조건 일시적으로 비활성화 (필요한 경우)
-- PostgreSQL에서는 CASCADE UPDATE가 자동으로 처리되므로 일반적으로 필요하지 않음

-- 3. 먼저 team 테이블에 새로운 이메일로 레코드 생성
INSERT INTO team (email, name_ko, name_en, phone, position, languages, avatar_url, is_active, hire_date, status, created_at, updated_at, emergency_contact, date_of_birth, ssn, personal_car_model, car_year, car_plate, bank_name, account_holder, bank_number, routing_number, cpr, cpr_acquired, cpr_expired, medical_report, medical_acquired, medical_expired)
SELECT 
    'jameshan82@gmail.com' as email,
    name_ko, name_en, phone, position, languages, avatar_url, is_active, hire_date, status, created_at, updated_at, emergency_contact, date_of_birth, ssn, personal_car_model, car_year, car_plate, bank_name, account_holder, bank_number, routing_number, cpr, cpr_acquired, cpr_expired, medical_report, medical_acquired, medical_expired
FROM team 
WHERE email = 'Jameshan82@gmail.com';

-- 4. 외래키를 참조하는 테이블들을 업데이트
-- tours 테이블의 외래키 업데이트
UPDATE tours 
SET tour_guide_id = 'jameshan82@gmail.com'
WHERE tour_guide_id = 'Jameshan82@gmail.com';

UPDATE tours 
SET assistant_id = 'jameshan82@gmail.com'
WHERE assistant_id = 'Jameshan82@gmail.com';

-- off_schedules 테이블의 외래키 업데이트
UPDATE off_schedules 
SET team_email = 'jameshan82@gmail.com'
WHERE team_email = 'Jameshan82@gmail.com';

UPDATE off_schedules 
SET approved_by = 'jameshan82@gmail.com'
WHERE approved_by = 'Jameshan82@gmail.com';

-- 5. 마지막으로 기존 team 레코드 삭제
DELETE FROM team 
WHERE email = 'Jameshan82@gmail.com';

-- 6. 업데이트 후 데이터 확인
SELECT 'After update - team table:' as info;
SELECT email, name_ko FROM team WHERE email ILIKE '%jameshan82%';

SELECT 'After update - tours table:' as info;
SELECT id, tour_guide_id, assistant_id FROM tours 
WHERE tour_guide_id ILIKE '%jameshan82%' OR assistant_id ILIKE '%jameshan82%';

SELECT 'After update - off_schedules table:' as info;
SELECT id, team_email, approved_by FROM off_schedules 
WHERE team_email ILIKE '%jameshan82%' OR approved_by ILIKE '%jameshan82%';

-- 7. 영향받은 레코드 수 확인
SELECT 
    'Summary:' as info,
    (SELECT COUNT(*) FROM team WHERE email = 'jameshan82@gmail.com') as team_records,
    (SELECT COUNT(*) FROM tours WHERE tour_guide_id = 'jameshan82@gmail.com' OR assistant_id = 'jameshan82@gmail.com') as tours_records,
    (SELECT COUNT(*) FROM off_schedules WHERE team_email = 'jameshan82@gmail.com' OR approved_by = 'jameshan82@gmail.com') as off_schedules_records;

COMMIT;

-- 롤백이 필요한 경우:
-- ROLLBACK;
