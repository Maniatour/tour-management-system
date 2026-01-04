-- 메시지 텍스트 해시를 추가하여 같은 텍스트의 번역을 재사용할 수 있도록 개선
ALTER TABLE message_translations 
ADD COLUMN IF NOT EXISTS message_text_hash TEXT;

-- 메시지 텍스트 해시 인덱스 생성 (번역 재사용을 위한 빠른 검색)
CREATE INDEX IF NOT EXISTS idx_message_translations_text_hash_language 
ON message_translations(message_text_hash, target_language, source_language) 
WHERE message_text_hash IS NOT NULL;

-- 기존 데이터에 대한 해시값 업데이트 (선택사항)
-- chat_messages 테이블과 조인하여 메시지 텍스트의 해시값 계산
-- 이 부분은 애플리케이션 레벨에서 처리하는 것이 더 안전함

