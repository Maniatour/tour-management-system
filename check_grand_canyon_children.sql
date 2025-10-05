-- 그랜드캐년과 그 하위 관광지들 확인
SELECT 
    tc1.id as parent_id,
    tc1.team_name_ko as parent_name,
    tc2.id as child_id,
    tc2.team_name_ko as child_name,
    tc2.parent_id
FROM tour_courses tc1
LEFT JOIN tour_courses tc2 ON tc1.id = tc2.parent_id
WHERE tc1.team_name_ko = '그랜드캐년'
ORDER BY tc2.team_name_ko;
