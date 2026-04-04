-- Invoice # 단위 Zelle 확인 스크린샷 URL (ticket_invoice_attachments 와 동일 키)

ALTER TABLE ticket_invoice_attachments
  ADD COLUMN IF NOT EXISTS zelle_file_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN ticket_invoice_attachments.zelle_file_urls IS '동일 Invoice#에 대한 Zelle 확인 스크린샷 등 공개 URL 배열(JSON)';
