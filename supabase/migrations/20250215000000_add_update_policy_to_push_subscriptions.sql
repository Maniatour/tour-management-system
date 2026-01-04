-- Add UPDATE policy to push_subscriptions table
-- This allows users to update their existing subscriptions

-- 사용자가 자신의 구독을 업데이트할 수 있음
CREATE POLICY "Users can update their own subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

