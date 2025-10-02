-- 2단계: 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_title_search ON documents USING GIN(to_tsvector('simple', title || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_document_reminders_document_id ON document_reminders(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_reminder_date ON document_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_document_reminders_status ON document_reminders(status);

CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id ON document_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_document_download_logs_document_id ON document_download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_download_logs_user_id ON document_download_logs(user_id);
