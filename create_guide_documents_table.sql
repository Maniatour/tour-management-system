-- 가이드 문서 테이블 생성
CREATE TABLE IF NOT EXISTS guide_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('medical', 'cpr')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_guide_documents_user_email ON guide_documents(user_email);
CREATE INDEX IF NOT EXISTS idx_guide_documents_type ON guide_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_guide_documents_user_type ON guide_documents(user_email, document_type);

-- RLS 정책 설정
ALTER TABLE guide_documents ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 문서만 볼 수 있음
CREATE POLICY "Users can view their own documents" ON guide_documents
  FOR SELECT USING (auth.email() = user_email);

-- 사용자는 자신의 문서만 삽입할 수 있음
CREATE POLICY "Users can insert their own documents" ON guide_documents
  FOR INSERT WITH CHECK (auth.email() = user_email);

-- 사용자는 자신의 문서만 업데이트할 수 있음
CREATE POLICY "Users can update their own documents" ON guide_documents
  FOR UPDATE USING (auth.email() = user_email);

-- 사용자는 자신의 문서만 삭제할 수 있음
CREATE POLICY "Users can delete their own documents" ON guide_documents
  FOR DELETE USING (auth.email() = user_email);

-- 관리자, 매니저는 모든 문서를 볼 수 있음
CREATE POLICY "Admins and managers can view all documents" ON guide_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.role IN ('admin', 'manager')
    )
  );

-- 관리자, 매니저는 모든 문서를 삭제할 수 있음
CREATE POLICY "Admins and managers can delete all documents" ON guide_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.role IN ('admin', 'manager')
    )
  );

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_guide_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guide_documents_updated_at
  BEFORE UPDATE ON guide_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_guide_documents_updated_at();

-- 스토리지 버킷 정책 설정 (이미 존재하는 경우 무시)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 가이드 문서 폴더에 대한 스토리지 정책
CREATE POLICY "Users can upload guide documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND auth.email() IS NOT NULL
  );

CREATE POLICY "Users can view guide documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
  );

CREATE POLICY "Users can delete their own guide documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND auth.email() IS NOT NULL
  );

-- 관리자, 매니저는 모든 가이드 문서를 관리할 수 있음
CREATE POLICY "Admins and managers can manage all guide documents" ON storage.objects
  FOR ALL USING (
    bucket_id = 'uploads' 
    AND (storage.foldername(name))[1] = 'guide-documents'
    AND EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.email() 
      AND team.role IN ('admin', 'manager')
    )
  );
