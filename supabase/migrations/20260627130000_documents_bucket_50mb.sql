-- 팀원 정보·문서 관리(documents 버킷) 업로드 용량 상향: 10MB → 50MB
-- TeamMemberForm TEAM_DOCUMENT_MAX_BYTES 와 동일하게 유지할 것.

UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50 MiB
WHERE id = 'documents';
