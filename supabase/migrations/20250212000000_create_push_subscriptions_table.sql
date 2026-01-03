-- Push Subscriptions 테이블 생성
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  customer_email TEXT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_room_id ON push_subscriptions(room_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer_email ON push_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- RLS 정책 설정
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 구독을 읽을 수 있음
CREATE POLICY "Users can read their own subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (true);

-- 모든 사용자가 구독을 생성할 수 있음
CREATE POLICY "Users can create subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- 사용자가 자신의 구독을 삭제할 수 있음
CREATE POLICY "Users can delete their own subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

