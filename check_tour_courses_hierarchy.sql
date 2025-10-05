-- 투어 코스 계층 구조 확인
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
WHERE team_name_ko IN ('라스베가스', '모뉴먼트 밸리', '그랜드캐년')
ORDER BY team_name_ko;
