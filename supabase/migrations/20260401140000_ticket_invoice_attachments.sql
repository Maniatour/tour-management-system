-- 입장권 Invoice # 단위 인보이스 이미지/파일 URL (RN·부킹 행과 무관하게 동일 Invoice# 공유)

CREATE TABLE IF NOT EXISTS ticket_invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  file_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ticket_invoice_attachments_company_invoice_unique UNIQUE (company, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_ticket_invoice_attachments_company
  ON ticket_invoice_attachments (company);

COMMENT ON TABLE ticket_invoice_attachments IS '입장권 부킹 Invoice#별 인보이스 이미지·파일 URL';
COMMENT ON COLUMN ticket_invoice_attachments.company IS 'ticket_bookings.company와 동일';
COMMENT ON COLUMN ticket_invoice_attachments.invoice_number IS 'Invoice # (trimmed 저장 권장)';
COMMENT ON COLUMN ticket_invoice_attachments.file_urls IS '공개 스토리지 URL 배열(JSON)';

ALTER TABLE ticket_invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_invoice_attachments_authenticated_all"
  ON ticket_invoice_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
