-- 팀원 문서 저장소 버킷 생성
-- 팀원 정보 수정 모달에서 사용하는 문서 업로드용 버킷

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 팀원 문서 저장소 정책 설정
-- 팀원은 문서를 업로드할 수 있음 (모든 활성 팀원)
CREATE POLICY "팀원은 문서를 업로드할 수 있음" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
    )
  );

-- 팀원은 문서를 조회할 수 있음 (모든 활성 팀원)
CREATE POLICY "팀원은 문서를 조회할 수 있음" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
    )
  );

-- 팀원은 자신의 문서를 삭제할 수 있음
-- 파일 경로가 team-documents/{email}/... 형식이므로 두 번째 폴더가 이메일
CREATE POLICY "팀원은 자신의 문서를 삭제할 수 있음" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND (storage.foldername(name))[2] = team.email
    )
  );

-- 관리자 권한을 가진 사용자(Super, Office Manager, OP)는 모든 문서를 삭제할 수 있음
CREATE POLICY "관리자는 모든 문서를 삭제할 수 있음" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND LOWER(team.position) IN ('super', 'office manager', 'op')
    )
  );

-- 성공 메시지
SELECT '팀원 문서 저장소가 생성되었습니다.' as message;
