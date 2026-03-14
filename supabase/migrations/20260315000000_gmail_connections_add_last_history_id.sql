-- Gmail History API 동기화: 마지막으로 처리한 historyId 저장 (다음 동기화 시 startHistoryId로 사용)
ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS last_history_id TEXT;

COMMENT ON COLUMN gmail_connections.last_history_id IS 'Gmail API history.list용; 이 ID 이후 추가된 메일만 가져옴';
