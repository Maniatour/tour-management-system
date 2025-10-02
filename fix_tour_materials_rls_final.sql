-- tour_materials 테이블의 RLS 정책을 대소문자 구분 없이 수정
-- team.position이 이미 citext로 설정되어 있으므로 직접 비교 가능

-- 기존 정책 삭제
DROP POLICY IF EXISTS "투어 자료는 관리자만 수정할 수 있음" ON tour_materials;

-- 새로운 정책 생성 (citext로 인해 대소문자 구분 없음)
CREATE POLICY "투어 자료는 관리자만 수정할 수 있음" ON tour_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 다른 관련 테이블들도 동일하게 확인 및 업데이트
-- tour_attractions 테이블
DROP POLICY IF EXISTS "관광지는 관리자만 수정할 수 있음" ON tour_attractions;
CREATE POLICY "관광지는 관리자만 수정할 수 있음" ON tour_attractions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- tour_material_categories 테이블
DROP POLICY IF EXISTS "투어 자료 카테고리는 관리자만 수정할 수 있음" ON tour_material_categories;
CREATE POLICY "투어 자료 카테고리는 관리자만 수정할 수 있음" ON tour_material_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- guide_quizzes 테이블
DROP POLICY IF EXISTS "가이드 퀴즈는 관리자만 수정할 수 있음" ON guide_quizzes;
CREATE POLICY "가이드 퀴즈는 관리자만 수정할 수 있음" ON guide_quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.position IN ('super', 'office manager')
    )
  );

-- 현재 사용자의 position 확인을 위한 쿼리
SELECT 
  email,
  position,
  CASE 
    WHEN position IN ('super', 'office manager') THEN 'admin_access'
    ELSE 'no_admin_access'
  END as access_level
FROM team 
WHERE email = auth.email();
