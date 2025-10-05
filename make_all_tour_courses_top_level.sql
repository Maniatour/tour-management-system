-- 모든 투어 코스를 최상위 관광지로 변경 (계층 구조 제거)
UPDATE tour_courses 
SET parent_id = NULL;

-- 변경 결과 확인
SELECT 
    id,
    team_name_ko,
    team_name_en,
    parent_id,
    CASE 
        WHEN parent_id IS NULL THEN '최상위'
        ELSE '하위'
    END as level_type
FROM tour_courses 
ORDER BY team_name_ko;
