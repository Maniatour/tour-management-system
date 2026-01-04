-- 메시지 번역 저장 테이블 생성
CREATE TABLE IF NOT EXISTS message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  target_language VARCHAR(10) NOT NULL, -- 'ko', 'en' 등
  translated_text TEXT NOT NULL,
  source_language VARCHAR(10), -- 원본 언어
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, target_language)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_message_translations_message_id ON message_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_message_translations_target_language ON message_translations(target_language);
CREATE INDEX IF NOT EXISTS idx_message_translations_message_language ON message_translations(message_id, target_language);

-- RLS 정책 설정
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 번역을 읽을 수 있음
CREATE POLICY "Users can read message translations"
  ON message_translations
  FOR SELECT
  USING (true);

-- 모든 사용자가 번역을 생성할 수 있음
CREATE POLICY "Users can create message translations"
  ON message_translations
  FOR INSERT
  WITH CHECK (true);

-- 사용자가 번역을 업데이트할 수 있음
CREATE POLICY "Users can update message translations"
  ON message_translations
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_message_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_translations_updated_at
  BEFORE UPDATE ON message_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_message_translations_updated_at();

