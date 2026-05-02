-- 거주·패스 안내 이메일 커스텀 템플릿 (locale별 1행). 플레이스홀더: {{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}}, {{FLOW_LINK_BLOCK}}
begin;

CREATE TABLE IF NOT EXISTS resident_inquiry_email_templates (
  locale TEXT PRIMARY KEY CHECK (locale IN ('ko', 'en')),
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

ALTER TABLE resident_inquiry_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to resident_inquiry_email_templates"
  ON resident_inquiry_email_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);

commit;
