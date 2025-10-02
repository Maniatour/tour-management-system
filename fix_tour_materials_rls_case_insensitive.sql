-- tour_materials 테이블의 RLS 정책을 대소문자 구분 없이 수정
-- position 검색 시 'super'와 'office manager'를 대소문자 구분 없이 비교

-- 기존 정책 삭제
DROP POLICY IF EXISTS "투어 자료는 관리자만 수정할 수 있음" ON tour_materials;

-- 새로운 정책 생성 (대소문자 구분 없음)
CREATE POLICY "투어 자료는 관리자만 수정할 수 있음" ON tour_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND LOWER(team.position) IN ('super', 'office manager')
    )
  );

-- 다른 관련 테이블들도 동일하게 수정
-- tour_attractions 테이블
DROP POLICY IF EXISTS "관광지는 관리자만 수정할 수 있음" ON tour_attractions;
CREATE POLICY "관광지는 관리자만 수정할 수 있음" ON tour_attractions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND LOWER(team.position) IN ('super', 'office manager')
    )
  );

-- tour_material_categories 테이블
DROP POLICY IF EXISTS "투어 자료 카테고리는 관리자만 수정할 수 있음" ON tour_material_categories;
CREATE POLICY "투어 자료 카테고리는 관리자만 수정할 수 있음" ON tour_material_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND LOWER(team.position) IN ('super', 'office manager')
    )
  );

-- guide_quizzes 테이블
DROP POLICY IF EXISTS "가이드 퀴즈는 관리자만 수정할 수 있음" ON guide_quizzes;
CREATE POLICY "가이드 퀴즈는 관리자만 수정할 수 있음" ON guide_quizzes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND LOWER(team.position) IN ('super', 'office manager')
    )
  );

-- 스토리지 정책도 수정 (주석 처리된 부분이므로 실제 적용 시 활성화)
-- CREATE POLICY "투어 자료 업로드" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND LOWER(team.position) IN ('super', 'office manager')
--     )
--   );

-- CREATE POLICY "투어 자료 업데이트" ON storage.objects
--   FOR UPDATE USING (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND LOWER(team.position) IN ('super', 'office manager')
--     )
--   );

-- CREATE POLICY "투어 자료 삭제" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND LOWER(team.position) IN ('super', 'office manager')
--     )
--   );
